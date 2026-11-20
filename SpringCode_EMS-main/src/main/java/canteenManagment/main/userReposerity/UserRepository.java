package canteenManagment.main.userReposerity;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.UserEntity;

@Repository
public interface UserRepository extends MongoRepository<UserEntity, Long> {

    Optional<UserEntity> findByName(String name);

    Optional<UserEntity> findByEmail(String email);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    void deleteByEmail(String email);

    // Counting is inherited from MongoRepository#count().
}
