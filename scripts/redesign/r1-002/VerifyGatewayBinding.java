import java.nio.file.Path;
import java.util.Map;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.cloud.gateway.config.HttpClientProperties;

/** Real Spring Binder with the current executable JAR dependencies; no Spring context or network. */
class VerifyGatewayBinding {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Expected public certificate path");
        String prefix = "spring.cloud.gateway.server.webflux.httpclient";
        String certificate = Path.of(args[0]).toUri().toString();
        var binder = new Binder(new MapConfigurationPropertySource(Map.of(
                prefix + ".ssl.trusted-x509-certificates[0]", certificate,
                prefix + ".ssl.use-insecure-trust-manager", "false")));
        var bound = binder.bind(prefix, Bindable.of(HttpClientProperties.class)).get();
        if (!bound.getSsl().getTrustedX509Certificates().equals(java.util.List.of(certificate))
                || bound.getSsl().isUseInsecureTrustManager()) throw new IllegalStateException("Verified route CA did not bind");
        String old = "spring.cloud.gateway.httpclient";
        var legacy = new Binder(new MapConfigurationPropertySource(Map.of(
                old + ".ssl.trusted-x509-certificates[0]", certificate,
                old + ".ssl.use-insecure-trust-manager", "false")));
        if (legacy.bind(prefix, Bindable.of(HttpClientProperties.class)).isBound()) {
            throw new IllegalStateException("Old prefix unexpectedly populated the current configuration");
        }
        System.out.println("{\"currentPrefixBindsExactCertificate\":\"PASS\",\"insecureTrustManagerFalse\":\"PASS\",\"legacyPrefixUnbound\":\"PASS\",\"gatewayRouteHandshakeExecuted\":false,\"independentWebClientHandshakeExecuted\":false}");
    }
}
