package canteenManagment.main.UserEntity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

// java.util.Date: the Mongo driver hands dates back as util.Date, and
// java.sql.Date has no registered converter for that read path.
import java.util.Date;


import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "user")
public class UserEntity {
    @Id
    private Long id;
    private String email; 
    private String name;
    /** Accepted on write (register/login payloads) but never serialised back to clients. */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    /**
     * AES-GCM encrypted copy of the login password, written only so the Edit
     * employee dialog can show an administrator the saved password. `password`
     * above stays the single value the security layer reads.
     *
     * @JsonIgnore keeps it out of every API response and request body, while
     * Spring Data still persists it as an ordinary document field. Never send a
     * raw password to the client anywhere else.
     */
    @JsonIgnore
    private String encryptedPassword;
    private String role; // ADMIN, CUSTOMER, STAFF
    private  Date generatedDate ; 
    private String address; 
    private String phoneNumber;
    private String lowerName;
    private String registerImage;

    /**
     * Account switch the admin screen toggles. A deactivated person keeps their
     * history but can no longer sign in. Records written before this field
     * existed have no key in the document, so the initialiser keeps them active.
     */
    private Boolean active = Boolean.TRUE;

    /**
     * Task-management provision. Admins always manage tasks; this flag lets an
     * admin hand the same create/edit/delete rights to one tester. It is only
     * meaningful for the TESTER role and stays false everywhere else.
     */
    private Boolean taskManager = Boolean.FALSE;

    private Role roles;

    public enum Role {
        ADMIN, EMPLOYEE
    }

	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getEmail() {
		return email;
	}
	public void setEmail(String email) {
		this.email = email;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
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
	public Date getGeneratedDate() {
		return generatedDate;
	}
	public void setGeneratedDate(java.util.Date resultdate) {
		this.generatedDate = resultdate;
	}
	public String getAddress() {
		return address;
	}
	public void setAddress(String address) {
		this.address = address;
	}
	public String getPhoneNumber() {
		return phoneNumber;
	}
	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}
	public String getLowerName() {
		return lowerName;
	}
	public void setLowerName(String lowerName) {
		this.lowerName = lowerName;
	}
	public String getRegisterImage() {
		return registerImage;
	}
	public void setRegisterImage(String registerImage) {
		this.registerImage = registerImage;
	}
	
    
}