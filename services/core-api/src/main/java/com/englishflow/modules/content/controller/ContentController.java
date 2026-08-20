package com.englishflow.modules.content.controller;

import java.util.Map;

import com.englishflow.modules.content.service.ContentSupplyChainService;
import com.englishflow.modules.content.ContentModuleException;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/content")
public final class ContentController {
    private final ContentSupplyChainService service;
    public ContentController(ContentSupplyChainService service) { this.service = service; }
    @PostMapping public Map<String, Object> create(@RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.create(body, actor(request)); }
    @GetMapping("/{contentId}") public Map<String, Object> learner(@PathVariable String contentId, HttpServletRequest request) { requireAuth(request); return service.learnerContent(contentId); }
    @PostMapping("/{contentId}/versions") public Map<String, Object> version(@PathVariable String contentId, @RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.createVersion(contentId, body, actor(request)); }
    @GetMapping("/{contentId}/versions/{versionId}/preview") public Map<String, Object> preview(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.preview(contentId, versionId); }
    @GetMapping("/{contentId}/versions/{versionId}/diff") public Map<String, Object> diff(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.diff(contentId, versionId); }
    @PostMapping("/{contentId}/versions/{versionId}/submit") public Map<String, Object> submit(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.submit(contentId, versionId, actor(request)); }
    @PostMapping("/{contentId}/versions/{versionId}/review") public Map<String, Object> review(@PathVariable String contentId, @PathVariable String versionId, @RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.review(contentId, versionId, body, actor(request)); }
    @PostMapping("/{contentId}/versions/{versionId}/publish") public Map<String, Object> publish(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.publish(contentId, versionId, actor(request)); }
    @PostMapping("/{contentId}/versions/{versionId}/archive") public Map<String, Object> archive(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.archive(contentId, versionId, actor(request)); }
    @PostMapping("/{contentId}/versions/{versionId}/restore") public Map<String, Object> restore(@PathVariable String contentId, @PathVariable String versionId, HttpServletRequest request) { requireAuth(request); return service.restore(contentId, versionId, actor(request)); }
    @PostMapping("/imports") public Map<String, Object> imports(@RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.importBatch(body, actor(request)); }
    @PostMapping("/media/upload-intents") public Map<String, Object> uploadIntent(@RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.createUploadIntent(body, actor(request)); }
    @PostMapping("/media/{mediaAssetId}/complete") public Map<String, Object> complete(@PathVariable String mediaAssetId, @RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.completeMedia(mediaAssetId, body); }
    @PostMapping("/media/{mediaAssetId}/signed-access") public Map<String, Object> signed(@PathVariable String mediaAssetId, @RequestBody Map<String, Object> body, HttpServletRequest request) { requireAuth(request); return service.signedAccess(mediaAssetId, body, actor(request)); }
    @GetMapping("/offline/manifests/{manifestCode}") public Map<String, Object> manifest(@PathVariable String manifestCode, HttpServletRequest request) { requireAuth(request); return service.offlineManifest(manifestCode); }
    private static String actor(HttpServletRequest request) { String actor = request.getHeader("X-B1-Actor"); return actor == null || actor.isBlank() ? "phase1-actor" : actor.trim(); }
    private static void requireAuth(HttpServletRequest request) {
        if (!(request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE) instanceof UserRequestContext)) {
            throw new ContentModuleException("AUTH_REQUIRED", "需要登录", 401, false);
        }
    }
}
