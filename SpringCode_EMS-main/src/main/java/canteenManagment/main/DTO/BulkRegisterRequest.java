package canteenManagment.main.DTO;

import java.util.List;

/**
 * Payload of {@code POST /api/auth/bulk-register}: the admin onboarding screen
 * sends every pasted/CSV row in one request so 40 accounts can be created in a
 * single round trip instead of 40 multipart registrations.
 */
public class BulkRegisterRequest {

    private List<Row> users;

    public List<Row> getUsers() {
        return users;
    }

    public void setUsers(List<Row> users) {
        this.users = users;
    }

    public static class Row {
        private String name;
        private String email;
        private String password;
        private String role;
        private String phoneNumber;
        private String address;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }
    }
}
