package com.englishflow.iam.oidc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.ExternalIdentity;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.ProviderRefreshRotation;
import com.englishflow.iam.domain.ProviderSessionPort;
import com.englishflow.iam.domain.ProviderSessionReference;

import java.math.BigInteger;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Standards-based outbound OIDC adapter. It is an OAuth client only: all credentials come from
 * the configured external provider and no token, signing key or JWKS endpoint is created here.
 */
public final class HttpOidcProviderAdapter
        implements OidcProviderAdapter, JwksKeySetPort, ProviderSessionPort {

    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final Set<String> SUPPORTED_ALGORITHMS = Set.of(
            "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512");

    private final IamServiceProperties.OidcProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final HttpClient httpClient;
    private final String providerId;
    private final URI discoveryUri;
    private final URI expectedIssuer;
    private final String configurationError;

    private volatile ProviderState providerState;
    private volatile JwksSnapshot jwksSnapshot;

    public HttpOidcProviderAdapter(
            IamServiceProperties.OidcProperties properties,
            ObjectMapper objectMapper,
            Clock clock) {
        this(properties, objectMapper, clock, buildHttpClient(properties));
    }

    public HttpOidcProviderAdapter(
            IamServiceProperties.OidcProperties properties,
            ObjectMapper objectMapper,
            Clock clock,
            HttpClient httpClient) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.providerId = properties.getProviderId();
        this.discoveryUri = parseUri(properties.getDiscoveryUri());
        this.expectedIssuer = parseUri(properties.getExpectedIssuer());
        this.configurationError = configurationError(properties, providerId, discoveryUri, expectedIssuer);
    }

    @Override
    public String providerId() {
        return providerId;
    }

    @Override
    public OidcProviderMetadata metadata() {
        return discover().metadata();
    }

    @Override
    public String clientIdForRedirect(URI redirectUri) {
        Objects.requireNonNull(redirectUri, "redirectUri");
        return switch (redirectUri.getPort()) {
            case 18181 -> properties.getAdminClientId();
            case 18183 -> properties.getMobileH5ClientId();
            case -1 -> "englishflow".equalsIgnoreCase(redirectUri.getScheme())
                    ? properties.getMobileAppClientId() : properties.getLearnerClientId();
            default -> properties.getLearnerClientId();
        };
    }

    @Override
    public OidcProviderMetadata metadataForClient(String clientId) {
        OidcProviderMetadata current = metadata();
        return new OidcProviderMetadata(current.issuer(), current.authorizationEndpoint(),
                current.tokenEndpoint(), current.jwksUri(), clientId,
                current.scopes(), current.codeChallengeMethods());
    }

    @Override
    public JwksKeySetPort jwks() {
        return this;
    }

    @Override
    public VerifiedOidcIdentity exchangeAndVerify(AuthorizationCodeExchange exchange) {
        return exchangeForSession(exchange).identity();
    }

    @Override
    public OidcTokenSet exchangeForSession(AuthorizationCodeExchange exchange) {
        Objects.requireNonNull(exchange, "exchange");
        if (!providerId.equals(exchange.providerId())) {
            throw rejected();
        }
        if (exchange.expectedNonce() == null || exchange.expectedNonce().isBlank()) {
            throw invalidToken();
        }
        ProviderState state = discover();
        String clientId = exchange.clientId() == null ? state.metadata().clientId() : exchange.clientId();
        JsonNode tokenResponse = postTokenForm(state.metadata().tokenEndpoint(), Map.of(
                "grant_type", "authorization_code",
                "code", exchange.authorizationCode(),
                "redirect_uri", exchange.redirectUri().toString(),
                "client_id", clientId,
                "code_verifier", exchange.codeVerifier()), true);
        String idToken = requiredText(tokenResponse, "id_token", IamDecisionCode.OIDC_TOKEN_INVALID);
        VerifiedIdToken verified = verifyIdToken(idToken, exchange.expectedNonce(), state, clientId);
        Optional<String> accessToken = optionalText(tokenResponse, "access_token");
        Optional<String> refreshToken = optionalText(tokenResponse, "refresh_token");
        Optional<Instant> expiresAt = expiresAt(tokenResponse, Instant.now(clock));
        Optional<ProviderSessionReference> reference = providerSessionReference(verified);
        return new OidcTokenSet(verified.identity(), accessToken, refreshToken, expiresAt, reference);
    }

    @Override
    public JwksKeySet current() {
        JwksSnapshot current = jwksSnapshot;
        Instant now = Instant.now(clock);
        if (current != null && now.isBefore(current.fetchedAt().plus(positive(
                properties.getJwksMaxAge(), "jwksMaxAge")))) {
            return current.keySet();
        }
        return loadJwks(false).keySet();
    }

    @Override
    public JwksKeySet refresh() {
        return loadJwks(true).keySet();
    }

    @Override
    public ProviderRefreshRotation rotate(
            URI issuer,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        return rotate(issuer, properties.getClientId(), providerSessionReference, presentedRefreshToken);
    }

    @Override
    public ProviderRefreshRotation rotate(
            URI issuer,
            String providerClientId,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(providerSessionReference, "providerSessionReference");
        requireToken(presentedRefreshToken);
        ProviderState state = discover();
        if (!state.metadata().issuer().equals(issuer)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
        }
        JsonNode response = postTokenForm(state.metadata().tokenEndpoint(), Map.of(
                "grant_type", "refresh_token",
                "refresh_token", presentedRefreshToken,
                "client_id", providerClientId), true);
        String nextRefreshToken = requiredText(response, "refresh_token", IamDecisionCode.OIDC_TOKEN_INVALID);
        if (nextRefreshToken.equals(presentedRefreshToken)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.oidc.rotation_invalid");
        }
        Instant now = Instant.now(clock);
        Instant accessTokenExpiresAt = expiresAt(response, now)
                .orElseThrow(() -> new IamPolicyException(
                        IamDecisionCode.OIDC_TOKEN_INVALID,
                        "iam.oidc.expiry_missing"));
        String nextAccessToken = requiredText(response, "access_token", IamDecisionCode.OIDC_TOKEN_INVALID);
        return new ProviderRefreshRotation(
                providerSessionReference, nextRefreshToken, accessTokenExpiresAt, nextAccessToken);
    }

    @Override
    public void revoke(URI issuer, ProviderSessionReference providerSessionReference) {
        // A generic OIDC session reference is not a revocation credential. Do not send it as a
        // token to an RFC 7009 endpoint or pretend that a provider logout succeeded.
        throw new IamPolicyException(
                IamDecisionCode.OIDC_PROVIDER_REJECTED,
                "iam.oidc.revocation_handle_required");
    }

    @Override
    public void revoke(
            URI issuer,
            ProviderSessionReference providerSessionReference,
            String presentedRefreshToken) {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(providerSessionReference, "providerSessionReference");
        requireToken(presentedRefreshToken);
        ProviderState state = discover();
        if (!state.metadata().issuer().equals(issuer)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
        }
        URI revocationEndpoint = state.revocationEndpoint().orElseThrow(() -> new IamPolicyException(
                IamDecisionCode.OIDC_PROVIDER_REJECTED,
                "iam.oidc.revocation_unsupported"));
        postTokenForm(revocationEndpoint, Map.of(
                "token", presentedRefreshToken,
                "token_type_hint", "refresh_token",
                "client_id", state.metadata().clientId()), true);
    }

    private ProviderState discover() {
        if (configurationError != null) {
            throw new IamPolicyException(
                    IamDecisionCode.OIDC_PROVIDER_NOT_CONFIGURED,
                    "iam.oidc.provider_not_configured");
        }
        ProviderState current = providerState;
        Instant now = Instant.now(clock);
        if (current != null && now.isBefore(current.discoveredAt().plus(
                positive(properties.getDiscoveryCacheTtl(), "discoveryCacheTtl")))) {
            return current;
        }
        synchronized (this) {
            current = providerState;
            now = Instant.now(clock);
            if (current != null && now.isBefore(current.discoveredAt().plus(
                    positive(properties.getDiscoveryCacheTtl(), "discoveryCacheTtl")))) {
                return current;
            }
            JsonNode document = getJson(discoveryUri);
            try {
                URI issuer = URI.create(requiredText(document, "issuer", IamDecisionCode.OIDC_TOKEN_INVALID));
                if (expectedIssuer != null && !expectedIssuer.toString().equals(issuer.toString())) {
                    throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
                }
                URI authorizationEndpoint = URI.create(requiredText(
                        document, "authorization_endpoint", IamDecisionCode.OIDC_TOKEN_INVALID));
                URI tokenEndpoint = URI.create(requiredText(
                        document, "token_endpoint", IamDecisionCode.OIDC_TOKEN_INVALID));
                URI jwksUri = URI.create(requiredText(document, "jwks_uri", IamDecisionCode.OIDC_TOKEN_INVALID));
                Set<String> methods = textSet(document.get("code_challenge_methods_supported"));
                if (!methods.contains("S256")) {
                    throw new IamPolicyException(IamDecisionCode.OIDC_PKCE_INVALID, "iam.oidc.pkce_invalid");
                }
                requireSupportedProtocol(document, "response_types_supported", "code");
                requireSupportedProtocol(document, "grant_types_supported", "authorization_code");
                String clientId = properties.getClientId();
                Set<String> scopes = properties.getScopes();
                if (!scopes.contains("openid")) {
                    throw invalidConfiguration();
                }
                Set<String> supportedScopes = textSet(document.get("scopes_supported"));
                if (!supportedScopes.isEmpty() && !supportedScopes.containsAll(scopes)) {
                    throw invalidConfiguration();
                }
                String authMethod = properties.getClientAuthenticationMethod();
                Set<String> authMethods = textSet(document.get("token_endpoint_auth_methods_supported"));
                // Some public OIDC clients (including the local Keycloak profile) use PKCE and
                // token_endpoint_auth_method=none but omit "none" from this optional metadata
                // list. Keep public clients valid while retaining strict metadata validation for
                // confidential clients, which must be explicitly advertised by the provider.
                if (!authMethods.isEmpty() && !"none".equals(authMethod) && !authMethods.contains(authMethod)) {
                    throw invalidConfiguration();
                }
                OidcProviderMetadata metadata = new OidcProviderMetadata(
                        issuer,
                        authorizationEndpoint,
                        tokenEndpoint,
                        jwksUri,
                        clientId,
                        scopes,
                        methods);
                Optional<URI> revocationEndpoint = optionalUri(document, "revocation_endpoint");
                current = new ProviderState(metadata, revocationEndpoint, now);
                providerState = current;
                return current;
            } catch (IamPolicyException exception) {
                throw exception;
            } catch (RuntimeException exception) {
                throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.oidc.discovery_invalid");
            }
        }
    }

    private JwksSnapshot loadJwks(boolean force) {
        ProviderState state = discover();
        JwksSnapshot current = jwksSnapshot;
        Instant now = Instant.now(clock);
        if (!force && current != null && now.isBefore(current.fetchedAt().plus(
                positive(properties.getJwksMaxAge(), "jwksMaxAge")))) {
            return current;
        }
        synchronized (this) {
            current = jwksSnapshot;
            now = Instant.now(clock);
            if (!force && current != null && now.isBefore(current.fetchedAt().plus(
                    positive(properties.getJwksMaxAge(), "jwksMaxAge")))) {
                return current;
            }
            HttpRequest.Builder request = HttpRequest.newBuilder(state.metadata().jwksUri())
                    .timeout(positive(properties.getRequestTimeout(), "requestTimeout"))
                    .header("Accept", "application/json")
                    .GET();
            if (current != null && current.etag() != null && !current.etag().isBlank()) {
                request.header("If-None-Match", current.etag());
            }
            HttpResponse<String> response = send(request.build());
            if (response.statusCode() == 304 && current != null) {
                JwksSnapshot refreshed = current.withFetchedAt(now);
                jwksSnapshot = refreshed;
                return refreshed;
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_UNAVAILABLE,
                        "iam.oidc.jwks_unavailable");
            }
            try {
                JsonNode document = objectMapper.readTree(response.body());
                JsonNode keys = document == null ? null : document.get("keys");
                if (keys == null || !keys.isArray()) {
                    throw invalidJwks();
                }
                Map<String, JwkKey> parsed = new HashMap<>();
                List<JwksKeyDescriptor> descriptors = new ArrayList<>();
                for (JsonNode key : keys) {
                    if (key == null || !key.isObject()) {
                        continue;
                    }
                    String use = text(key, "use");
                    if (use != null && !"sig".equals(use)) {
                        continue;
                    }
                    JwkKey parsedKey = parseJwk(key);
                    if (parsed.putIfAbsent(parsedKey.keyId(), parsedKey) != null) {
                        throw invalidJwks();
                    }
                    descriptors.add(new JwksKeyDescriptor(
                            parsedKey.keyId(), parsedKey.keyType(), parsedKey.algorithm(), "sig"));
                }
                if (parsed.isEmpty()) {
                    throw invalidJwks();
                }
                String etag = response.headers().firstValue("ETag").orElse(null);
                JwksSnapshot snapshot = new JwksSnapshot(
                        new JwksKeySet(state.metadata().issuer().toString(), now, descriptors, etag),
                        parsed,
                        etag);
                jwksSnapshot = snapshot;
                return snapshot;
            } catch (IamPolicyException exception) {
                throw exception;
            } catch (JsonProcessingException exception) {
                throw invalidJwks();
            } catch (RuntimeException exception) {
                throw invalidJwks();
            }
        }
    }

    private VerifiedIdToken verifyIdToken(
            String compact, String expectedNonce, ProviderState state, String clientId) {
        JwtParts jwt = parseJwt(compact);
        String algorithm = requiredText(jwt.header(), "alg", IamDecisionCode.OIDC_TOKEN_INVALID);
        if (!SUPPORTED_ALGORITHMS.contains(algorithm)) {
            throw invalidSignature();
        }
        String keyId = requiredText(jwt.header(), "kid", IamDecisionCode.OIDC_TOKEN_INVALID);
        JwksSnapshot keys = loadJwks(false);
        JwkKey key = keys.keys().get(keyId);
        if (key == null || !algorithm.equals(key.algorithm())) {
            keys = loadJwks(true);
            key = keys.keys().get(keyId);
        }
        if (key == null || !algorithm.equals(key.algorithm())) {
            throw invalidSignature();
        }
        verifySignature(jwt, algorithm, key.publicKey());
        JsonNode claims = jwt.claims();
        String issuer = requiredText(claims, "iss", IamDecisionCode.OIDC_ISSUER_INVALID);
        if (!state.metadata().issuer().toString().equals(issuer)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_ISSUER_INVALID, "iam.oidc.issuer_invalid");
        }
        String subject = requiredText(claims, "sub", IamDecisionCode.OIDC_TOKEN_INVALID);
        Set<String> audiences = audiences(claims.get("aud"));
        if (!audiences.contains(clientId)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID, "iam.oidc.audience_invalid");
        }
        if (audiences.size() > 1 && !clientId.equals(text(claims, "azp"))) {
            throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID, "iam.oidc.audience_invalid");
        }
        Instant now = Instant.now(clock);
        Duration skew = positive(properties.getClockSkew(), "clockSkew");
        Instant expiresAt = numericInstant(claims, "exp");
        if (!now.minus(skew).isBefore(expiresAt)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_EXPIRED, "iam.oidc.token_expired");
        }
        Instant issuedAt = numericInstant(claims, "iat");
        if (issuedAt.isAfter(now.plus(skew))) {
            throw invalidToken();
        }
        JsonNode notBefore = claims.get("nbf");
        if (notBefore != null && !notBefore.isNull()
                && Instant.ofEpochSecond(requiredLong(notBefore, "nbf")).isAfter(now.plus(skew))) {
            throw invalidToken();
        }
        String nonce = requiredText(claims, "nonce", IamDecisionCode.OIDC_NONCE_INVALID);
        if (!constantTimeEquals(expectedNonce, nonce)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_NONCE_INVALID, "iam.oidc.nonce_invalid");
        }
        Optional<TrustedIdpAgeClaim> ageClaim = parseAgeClaim(claims, now);
        VerifiedOidcIdentity identity = new VerifiedOidcIdentity(
                new ExternalIdentity(state.metadata().issuer(), subject),
                nonce,
                ageClaim,
                now);
        return new VerifiedIdToken(identity, text(claims, "sid"));
    }

    private JsonNode postTokenForm(URI endpoint, Map<String, String> values, boolean authenticate) {
        String form = values.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
        HttpRequest.Builder request = HttpRequest.newBuilder(endpoint)
                .timeout(positive(properties.getRequestTimeout(), "requestTimeout"))
                .header("Accept", "application/json")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8));
        if (authenticate && "client_secret_basic".equals(properties.getClientAuthenticationMethod())) {
            String credentials = properties.getClientId() + ":" + properties.getClientSecret();
            request.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(
                    credentials.getBytes(StandardCharsets.UTF_8)));
        } else if (authenticate && "client_secret_post".equals(properties.getClientAuthenticationMethod())) {
            // The configured client id/secret are added only to this outbound request.
            form = form + "&" + encode("client_secret") + "=" + encode(properties.getClientSecret());
            request.POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8));
        }
        HttpResponse<String> response = send(request.build());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                    "iam.oidc.provider_rejected");
        }
        try {
            JsonNode body = objectMapper.readTree(response.body());
            if (body == null || !body.isObject()) {
                throw invalidToken();
            }
            return body;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (Exception exception) {
            throw invalidToken();
        }
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(
                    StandardCharsets.UTF_8));
            if (response.body() != null && response.body().getBytes(StandardCharsets.UTF_8).length > MAX_RESPONSE_BYTES) {
                throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.response_too_large");
            }
            return response;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_UNAVAILABLE,
                    "iam.oidc.provider_unavailable");
        } catch (Exception exception) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_UNAVAILABLE,
                    "iam.oidc.provider_unavailable");
        }
    }

    private JsonNode getJson(URI endpoint) {
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(positive(properties.getRequestTimeout(), "requestTimeout"))
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_UNAVAILABLE,
                    "iam.oidc.discovery_unavailable");
        }
        try {
            JsonNode body = objectMapper.readTree(response.body());
            if (body == null || !body.isObject()) {
                throw invalidToken();
            }
            return body;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID,
                    "iam.oidc.discovery_invalid");
        }
    }

    private JwkKey parseJwk(JsonNode key) {
        String keyId = requiredText(key, "kid", IamDecisionCode.OIDC_JWKS_INVALID);
        String keyType = requiredText(key, "kty", IamDecisionCode.OIDC_JWKS_INVALID);
        String algorithm = requiredText(key, "alg", IamDecisionCode.OIDC_JWKS_INVALID);
        if (!SUPPORTED_ALGORITHMS.contains(algorithm)) {
            throw invalidJwks();
        }
        try {
            PublicKey publicKey;
            if ("RSA".equals(keyType) && algorithm.startsWith("RS")) {
                byte[] modulus = decodeBase64(requiredText(key, "n", IamDecisionCode.OIDC_JWKS_INVALID));
                byte[] exponent = decodeBase64(requiredText(key, "e", IamDecisionCode.OIDC_JWKS_INVALID));
                publicKey = KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(
                        new BigInteger(1, modulus), new BigInteger(1, exponent)));
            } else if ("RSA".equals(keyType) && algorithm.startsWith("PS")) {
                byte[] modulus = decodeBase64(requiredText(key, "n", IamDecisionCode.OIDC_JWKS_INVALID));
                byte[] exponent = decodeBase64(requiredText(key, "e", IamDecisionCode.OIDC_JWKS_INVALID));
                publicKey = KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(
                        new BigInteger(1, modulus), new BigInteger(1, exponent)));
            } else if ("EC".equals(keyType) && algorithm.startsWith("ES")) {
                String curve = requiredText(key, "crv", IamDecisionCode.OIDC_JWKS_INVALID);
                String jcaCurve = switch (curve) {
                    case "P-256" -> "secp256r1";
                    case "P-384" -> "secp384r1";
                    case "P-521" -> "secp521r1";
                    default -> throw invalidJwks();
                };
                AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
                parameters.init(new ECGenParameterSpec(jcaCurve));
                ECParameterSpec spec = parameters.getParameterSpec(ECParameterSpec.class);
                byte[] x = decodeBase64(requiredText(key, "x", IamDecisionCode.OIDC_JWKS_INVALID));
                byte[] y = decodeBase64(requiredText(key, "y", IamDecisionCode.OIDC_JWKS_INVALID));
                publicKey = KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(
                        new ECPoint(new BigInteger(1, x), new BigInteger(1, y)), spec));
            } else {
                throw invalidJwks();
            }
            return new JwkKey(keyId, keyType, algorithm, publicKey);
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw invalidJwks();
        }
    }

    private void verifySignature(JwtParts jwt, String algorithm, PublicKey publicKey) {
        try {
            Signature signature = Signature.getInstance(signatureAlgorithm(algorithm));
            if (algorithm.startsWith("PS")) {
                int size = switch (algorithm) {
                    case "PS256" -> 32;
                    case "PS384" -> 48;
                    case "PS512" -> 64;
                    default -> throw invalidSignature();
                };
                signature.setParameter(new java.security.spec.PSSParameterSpec(
                        "SHA-" + (size * 8), "MGF1", new java.security.spec.MGF1ParameterSpec("SHA-" + (size * 8)),
                        size, 1));
            }
            signature.initVerify(publicKey);
            signature.update(jwt.signingInput().getBytes(StandardCharsets.US_ASCII));
            byte[] signatureBytes = Base64.getUrlDecoder().decode(jwt.signature());
            if (algorithm.startsWith("ES")) {
                signatureBytes = joseEcdsaToDer(signatureBytes);
            }
            if (!signature.verify(signatureBytes)) {
                throw invalidSignature();
            }
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw invalidSignature();
        }
    }

    private JwtParts parseJwt(String compact) {
        if (compact == null || compact.length() > 32768) {
            throw invalidToken();
        }
        String[] segments = compact.split("\\.", -1);
        if (segments.length != 3 || segments[0].isBlank() || segments[1].isBlank() || segments[2].isBlank()) {
            throw invalidToken();
        }
        try {
            JsonNode header = objectMapper.readTree(new String(decodeBase64(segments[0]), StandardCharsets.UTF_8));
            JsonNode claims = objectMapper.readTree(new String(decodeBase64(segments[1]), StandardCharsets.UTF_8));
            if (header == null || !header.isObject() || claims == null || !claims.isObject()
                    || (header.has("crit") && header.get("crit").size() > 0)) {
                throw invalidToken();
            }
            return new JwtParts(header, claims, segments[0] + "." + segments[1], segments[2]);
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (Exception exception) {
            throw invalidToken();
        }
    }

    private Optional<TrustedIdpAgeClaim> parseAgeClaim(JsonNode claims, Instant now) {
        String claimName = properties.getAgeClaim();
        if (claimName == null || claimName.isBlank() || !claims.has(claimName)) {
            return Optional.empty();
        }
        JsonNode value = claims.get(claimName);
        if (value == null || !value.isIntegralNumber()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_IDENTITY_INVALID,
                    "iam.oidc.age_claim_invalid");
        }
        try {
            if (!value.canConvertToInt()) {
                throw new ArithmeticException("age claim out of int range");
            }
            return Optional.of(new TrustedIdpAgeClaim(value.intValue(), claimName, now));
        } catch (ArithmeticException | IllegalArgumentException exception) {
            throw new IamPolicyException(IamDecisionCode.OIDC_IDENTITY_INVALID,
                    "iam.oidc.age_claim_invalid");
        }
    }

    private Optional<ProviderSessionReference> providerSessionReference(VerifiedIdToken verified) {
        String reference = verified.sessionId() == null ? verified.identity().externalIdentity().subject()
                : verified.sessionId();
        try {
            return Optional.of(new ProviderSessionReference(reference));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private Optional<Instant> expiresAt(JsonNode response, Instant now) {
        JsonNode expiresIn = response.get("expires_in");
        if (expiresIn == null || !expiresIn.isIntegralNumber() || expiresIn.asLong() <= 0 || expiresIn.asLong() > 86400 * 30L) {
            return Optional.empty();
        }
        return Optional.of(now.plusSeconds(expiresIn.asLong()));
    }

    private static Set<String> audiences(JsonNode value) {
        if (value == null || value.isNull()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID, "iam.oidc.audience_invalid");
        }
        Set<String> result = new HashSet<>();
        if (value.isTextual()) {
            result.add(value.textValue());
        } else if (value.isArray()) {
            for (JsonNode item : value) {
                if (!item.isTextual() || item.textValue().isBlank()) {
                    throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID,
                            "iam.oidc.audience_invalid");
                }
                result.add(item.textValue());
            }
        } else {
            throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID, "iam.oidc.audience_invalid");
        }
        if (result.isEmpty()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_AUDIENCE_INVALID, "iam.oidc.audience_invalid");
        }
        return result;
    }

    private static Set<String> textSet(JsonNode value) {
        if (value == null || value.isNull()) {
            return Set.of();
        }
        if (!value.isArray()) {
            throw invalidConfiguration();
        }
        Set<String> values = new HashSet<>();
        for (JsonNode item : value) {
            if (!item.isTextual() || item.textValue().isBlank()) {
                throw invalidConfiguration();
            }
            values.add(item.textValue());
        }
        return values;
    }

    private static void requireSupportedProtocol(JsonNode document, String field, String required) {
        JsonNode values = document.get(field);
        if (values != null && values.isArray() && !textSet(values).contains(required)) {
            throw invalidConfiguration();
        }
    }

    private static String requiredText(JsonNode node, String field, IamDecisionCode code) {
        String value = text(node, field);
        if (value == null || value.isBlank() || value.length() > 16384
                || value.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(code, "iam.oidc.invalid_response");
        }
        return value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.textValue() : null;
    }

    private static Optional<String> optionalText(JsonNode node, String field) {
        String value = text(node, field);
        return value == null || value.isBlank() ? Optional.empty() : Optional.of(value);
    }

    private static Optional<URI> optionalUri(JsonNode node, String field) {
        String value = text(node, field);
        return value == null || value.isBlank() ? Optional.empty() : Optional.ofNullable(parseUri(value));
    }

    private static Instant numericInstant(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isIntegralNumber()) {
            throw invalidToken();
        }
        try {
            return Instant.ofEpochSecond(requiredLong(value, field));
        } catch (RuntimeException exception) {
            throw invalidToken();
        }
    }

    private static long requiredLong(JsonNode value, String field) {
        if (!value.canConvertToLong()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID,
                    "iam.oidc.claim_invalid");
        }
        return value.longValue();
    }

    private static byte[] decodeBase64(String value) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(value);
            if (decoded.length == 0) {
                throw invalidToken();
            }
            return decoded;
        } catch (IllegalArgumentException exception) {
            throw invalidToken();
        }
    }

    private static String signatureAlgorithm(String algorithm) {
        return switch (algorithm) {
            case "RS256", "PS256" -> algorithm.startsWith("PS") ? "RSASSA-PSS" : "SHA256withRSA";
            case "RS384" -> "SHA384withRSA";
            case "RS512" -> "SHA512withRSA";
            case "PS384", "PS512" -> "RSASSA-PSS";
            case "ES256" -> "SHA256withECDSA";
            case "ES384" -> "SHA384withECDSA";
            case "ES512" -> "SHA512withECDSA";
            default -> throw invalidSignature();
        };
    }

    private static byte[] joseEcdsaToDer(byte[] jose) {
        if (jose.length == 0 || jose.length % 2 != 0) {
            throw invalidSignature();
        }
        int half = jose.length / 2;
        byte[] r = derInteger(jose, 0, half);
        byte[] s = derInteger(jose, half, half);
        int length = 2 + r.length + 2 + s.length;
        byte[] result = new byte[2 + length];
        result[0] = 0x30;
        result[1] = (byte) length;
        int index = 2;
        result[index++] = 0x02;
        result[index++] = (byte) r.length;
        System.arraycopy(r, 0, result, index, r.length);
        index += r.length;
        result[index++] = 0x02;
        result[index++] = (byte) s.length;
        System.arraycopy(s, 0, result, index, s.length);
        return result;
    }

    private static byte[] derInteger(byte[] source, int offset, int length) {
        int start = offset;
        while (start < offset + length - 1 && source[start] == 0) {
            start++;
        }
        int resultLength = offset + length - start;
        boolean needsZero = (source[start] & 0x80) != 0;
        byte[] result = new byte[resultLength + (needsZero ? 1 : 0)];
        if (needsZero) {
            System.arraycopy(source, start, result, 1, resultLength);
        } else {
            System.arraycopy(source, start, result, 0, resultLength);
        }
        return result;
    }

    private static URI parseUri(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return URI.create(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String configurationError(
            IamServiceProperties.OidcProperties properties,
            String providerId,
            URI discoveryUri,
            URI expectedIssuer) {
        if (providerId == null || providerId.isBlank() || discoveryUri == null
                || properties.getClientId() == null || properties.getClientId().isBlank()
                || !Set.of("none", "client_secret_basic", "client_secret_post")
                .contains(properties.getClientAuthenticationMethod())
                || (!"none".equals(properties.getClientAuthenticationMethod())
                && (properties.getClientSecret() == null || properties.getClientSecret().isBlank()))) {
            return "oidc configuration is incomplete";
        }
        if (expectedIssuer != null && (!expectedIssuer.isAbsolute() || expectedIssuer.getFragment() != null
                || expectedIssuer.getUserInfo() != null)) {
            return "expected issuer is invalid";
        }
        return null;
    }

    private static HttpClient buildHttpClient(IamServiceProperties.OidcProperties properties) {
        Duration timeout = properties == null ? Duration.ofSeconds(5) : properties.getRequestTimeout();
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            timeout = Duration.ofSeconds(5);
        }
        return HttpClient.newBuilder().connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    private static Duration positive(Duration value, String name) {
        if (value == null || value.isNegative() || value.isZero()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_NOT_CONFIGURED,
                    "iam.oidc.provider_not_configured");
        }
        return value;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void requireToken(String token) {
        if (token == null || token.isBlank() || token.length() > 16384
                || token.chars().anyMatch(Character::isISOControl)) {
            throw invalidToken();
        }
    }

    private static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return java.security.MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    private static IamPolicyException invalidConfiguration() {
        return new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_NOT_CONFIGURED,
                "iam.oidc.provider_not_configured");
    }

    private static IamPolicyException rejected() {
        return new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                "iam.oidc.provider_rejected");
    }

    private static IamPolicyException invalidToken() {
        return new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.oidc.token_invalid");
    }

    private static IamPolicyException invalidSignature() {
        return new IamPolicyException(IamDecisionCode.OIDC_SIGNATURE_INVALID,
                "iam.oidc.signature_invalid");
    }

    private static IamPolicyException invalidJwks() {
        return new IamPolicyException(IamDecisionCode.OIDC_JWKS_INVALID, "iam.oidc.jwks_invalid");
    }

    private record ProviderState(
            OidcProviderMetadata metadata,
            Optional<URI> revocationEndpoint,
            Instant discoveredAt) {
    }

    private record JwkKey(String keyId, String keyType, String algorithm, PublicKey publicKey) {
    }

    private record JwksSnapshot(JwksKeySet keySet, Map<String, JwkKey> keys, String etag) {

        private Instant fetchedAt() {
            return keySet.fetchedAt();
        }

        private JwksSnapshot withFetchedAt(Instant fetchedAt) {
            return new JwksSnapshot(
                    new JwksKeySet(keySet.issuer(), fetchedAt, keySet.keys(), keySet.etag()), keys, etag);
        }
    }

    private record JwtParts(JsonNode header, JsonNode claims, String signingInput, String signature) {
    }

    private record VerifiedIdToken(VerifiedOidcIdentity identity, String sessionId) {
    }
}
