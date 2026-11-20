package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.MenuItem;

@Repository
public interface MenuRepository extends MongoRepository<MenuItem, Long> {
	
	
	
}