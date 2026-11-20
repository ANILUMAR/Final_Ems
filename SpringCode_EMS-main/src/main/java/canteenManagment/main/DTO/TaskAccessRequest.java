package canteenManagment.main.DTO;

/** Body for granting or revoking the tester task-management provision. */
public class TaskAccessRequest {

    private Boolean enabled;

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
