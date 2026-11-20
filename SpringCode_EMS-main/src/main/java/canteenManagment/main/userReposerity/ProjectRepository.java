package canteenManagment.main.userReposerity;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.Project;
@Repository

public interface ProjectRepository extends MongoRepository<Project, Long> {
    /** Duplicate guard for the admin "create project" screen. */
    Optional<Project> findFirstByNameIgnoreCase(String name);
}

