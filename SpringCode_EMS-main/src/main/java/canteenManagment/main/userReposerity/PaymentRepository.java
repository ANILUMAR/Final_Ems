package canteenManagment.main.userReposerity;


import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.Payment;
@Repository

public interface PaymentRepository extends MongoRepository<Payment, Long> {
}
