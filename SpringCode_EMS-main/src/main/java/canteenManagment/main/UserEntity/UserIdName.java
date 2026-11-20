package canteenManagment.main.UserEntity;

/**
 * Lightweight {id, name} payload for the assignee picker. Spring Data cannot
 * project an interface from a Mongo query the way a JPQL alias could, so this is
 * a small concrete carrier built from the user documents.
 */
public class UserIdName {

    private Long id;
    private String name;

    public UserIdName() {
    }

    public UserIdName(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
