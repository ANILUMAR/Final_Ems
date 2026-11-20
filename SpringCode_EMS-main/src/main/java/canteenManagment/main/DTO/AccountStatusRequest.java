package canteenManagment.main.DTO;

/**
 * Body of PATCH /api/auth/users/{id}/status - the activate/deactivate switch
 * on the Registered employees screen.
 */
public class AccountStatusRequest {

    private Boolean active;

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
