package canteenManagment.main.rbac;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Stores the dynamic screen access and permissions configuration for a given role.
 */
@Document(collection = "role_screen_access")
public class RolePermissionConfig implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    private String id;

    @Indexed(unique = true)
    private String role;

    private String roleName;

    private List<ScreenPermissionItem> permissions = new ArrayList<>();

    private Instant updatedAt;

    private String updatedBy;

    public RolePermissionConfig() {
    }

    public RolePermissionConfig(String role, String roleName, List<ScreenPermissionItem> permissions, String updatedBy) {
        this.id = "ROLE_CONFIG_" + role;
        this.role = role;
        this.roleName = roleName;
        this.permissions = permissions != null ? permissions : new ArrayList<>();
        this.updatedAt = Instant.now();
        this.updatedBy = updatedBy;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public List<ScreenPermissionItem> getPermissions() {
        return permissions;
    }

    public void setPermissions(List<ScreenPermissionItem> permissions) {
        this.permissions = permissions;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
