import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/** Offline trust-store preparation check. No server, HTTP request, JWT or registration. */
class VerifyTrust {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Expected public certificate path");
        X509Certificate certificate;
        try (var input = Files.newInputStream(Path.of(args[0]))) {
            certificate = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(input);
        }
        certificate.checkValidity();
        var factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        factory.init((KeyStore) null); // Uses this subprocess's dedicated javax.net.ssl trustStore.
        var trusted = (X509TrustManager) factory.getTrustManagers()[0];
        trusted.checkServerTrusted(new X509Certificate[]{certificate}, "RSA");
        if (trusted.getAcceptedIssuers().length != 1) throw new IllegalStateException("Test store must contain exactly one trust anchor");
        var empty = KeyStore.getInstance(KeyStore.getDefaultType());
        empty.load(null, null);
        var rejectedFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        rejectedFactory.init(empty);
        boolean rejected = false;
        try {
            ((X509TrustManager) rejectedFactory.getTrustManagers()[0]).checkServerTrusted(new X509Certificate[]{certificate}, "RSA");
        } catch (Exception expected) { rejected = true; }
        if (!rejected) throw new IllegalStateException("Empty store must reject this certificate");
        System.out.println("{\"dedicatedDefaultJvmTrust\":\"PASS\",\"exactlyOneTestAnchor\":\"PASS\",\"emptyStoreRejects\":\"PASS\",\"networkHandshakeExecuted\":false}");
    }
}
