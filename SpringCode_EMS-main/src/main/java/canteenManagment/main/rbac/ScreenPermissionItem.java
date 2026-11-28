package canteenManagment.main.rbac;

import java.io.Serializable;

/**
 * Screen permission state for a specific role.
 */
public class ScreenPermissionItem implements Serializable {

    private static final long serialVersionUID = 1L;

    private String screenId;
    private String screenName;
    private String route;
    private String category;
    private String icon;
    private String description;

    /** Whether the role can access / see this screen. */
    private boolean allowed;

    /** Detailed permissions for this screen */
    private boolean canView = true;
    private boolean canEdit = false;
    private boolean canDelete = false;
    private boolean canExport = false;

    public ScreenPermissionItem() {
    }

    public ScreenPermissionItem(String screenId, String screenName, String route, String category,
                                String icon, String description, boolean allowed,
                                boolean canView, boolean canEdit, boolean canDelete, boolean canExport) {
        this.screenId = screenId;
        this.screenName = screenName;
        this.route = route;
        this.category = category;
        this.icon = icon;
        this.description = description;
        this.allowed = allowed;
        this.canView = canView;
        this.canEdit = canEdit;
        this.canDelete = canDelete;
        this.canExport = canExport;
    }

    public static ScreenPermissionItem fromDefinition(ScreenDefinition def, boolean allowed,
                                                      boolean canEdit, boolean canDelete, boolean canExport) {
        return new ScreenPermissionItem(
                def.getId(),
                def.getName(),
                def.getRoute(),
                def.getCategory(),
                def.getIcon(),
                def.getDescription(),
                allowed,
                allowed,
                allowed && canEdit,
                allowed && canDelete,
                allowed && canExport
        );
    }

    public String getScreenId() {
        return screenId;
    }

    public void setScreenId(String screenId) {
        this.screenId = screenId;
    }

    public String getScreenName() {
        return screenName;
    }

    public void setScreenName(String screenName) {
        this.screenName = screenName;
    }

    /** Alias for JSON convenience in frontend */
    public String getName() {
        return screenName;
    }

    public void setName(String name) {
        if (this.screenName == null || this.screenName.isBlank()) {
            this.screenName = name;
        }
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isAllowed() {
        return allowed;
    }

    public void setAllowed(boolean allowed) {
        this.allowed = allowed;
    }

    public boolean isCanView() {
        return canView;
    }

    public void setCanView(boolean canView) {
        this.canView = canView;
    }

    public boolean isCanEdit() {
        return canEdit;
    }

    public void setCanEdit(boolean canEdit) {
        this.canEdit = canEdit;
    }

    public boolean isCanDelete() {
        return canDelete;
    }

    public void setCanDelete(boolean canDelete) {
        this.canDelete = canDelete;
    }

    public boolean isCanExport() {
        return canExport;
    }

    public void setCanExport(boolean canExport) {
        this.canExport = canExport;
    }
}
