package canteenManagment.main.rbac;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for centralized role-based screen access and permission configuration.
 */
@RestController
@RequestMapping("/api/role-permissions")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class RolePermissionController {

    private final RolePermissionService service;

    public RolePermissionController(RolePermissionService service) {
        this.service = service;
    }

    /**
     * Returns the master list of all application screens and their metadata.
     */
    @GetMapping("/screens")
    public ResponseEntity<List<ScreenDefinition>> getAllScreens() {
        return ResponseEntity.ok(service.getAllSystemScreens());
    }

    /**
     * Returns screen access configuration for all assignable roles (Admin only).
     */
    @GetMapping
    public ResponseEntity<List<RolePermissionConfig>> getAllConfigs() {
        return ResponseEntity.ok(service.getAllConfigs());
    }

    /**
     * Returns screen access configuration for a specific role.
     */
    @GetMapping("/{role}")
    public ResponseEntity<RolePermissionConfig> getConfigForRole(@PathVariable String role) {
        return ResponseEntity.ok(service.getConfigForRole(role));
    }

    /**
     * Returns route accessibility map (route -> boolean allowed) for a role.
     */
    @GetMapping("/{role}/accessible-routes")
    public ResponseEntity<Map<String, Boolean>> getAccessibleRoutesForRole(@PathVariable String role) {
        return ResponseEntity.ok(service.getAccessibleRoutesForRole(role));
    }

    /**
     * Updates screen permissions for a given role.
     */
    @PutMapping("/{role}")
    public ResponseEntity<RolePermissionConfig> saveConfigForRole(
            @PathVariable String role,
            @RequestBody List<ScreenPermissionItem> items,
            Principal principal) {
        String actor = principal != null ? principal.getName() : "Admin";
        RolePermissionConfig saved = service.saveConfigForRole(role, items, actor);
        return ResponseEntity.ok(saved);
    }

    /**
     * Resets screen permissions for a role to system defaults.
     */
    @PostMapping("/reset/{role}")
    public ResponseEntity<RolePermissionConfig> resetRoleToDefault(
            @PathVariable String role,
            Principal principal) {
        String actor = principal != null ? principal.getName() : "Admin";
        RolePermissionConfig reset = service.resetRoleToDefault(role, actor);
        return ResponseEntity.ok(reset);
    }
}
