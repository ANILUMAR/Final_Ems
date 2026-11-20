package canteenManagment.main.userReposerity;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.Order;


@Repository
public interface OrderRepository extends MongoRepository<Order, Long> {
   List<Order> findByStatus(String status);
}