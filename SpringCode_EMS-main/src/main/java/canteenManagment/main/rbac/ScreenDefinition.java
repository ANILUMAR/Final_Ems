package canteenManagment.main.rbac;

import java.io.Serializable;

/**
 * Metadata definition for a screen / route in the application.
 */
public class ScreenDefinition implements Serializable {

    private static final long serialVersionUID = 1L;

    private String id;
    private String name;
    private String route;
    private String category;
    private String icon;
    private String description;
    private int order;

    public ScreenDefinition() {
    }

    public ScreenDefinition(String id, String name, String route, String category, String icon, String description, int order) {
        this.id = id;
        this.name = name;
        this.route = route;
        this.category = category;
        this.icon = icon;
        this.description = description;
        this.order = order;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public int getOrder() {
        return order;
    }

    public void setOrder(int order) {
        this.order = order;
    }
}
