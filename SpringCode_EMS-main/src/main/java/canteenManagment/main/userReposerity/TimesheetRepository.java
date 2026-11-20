package canteenManagment.main.userReposerity;

import org.springframework.data.mongodb.repository.MongoRepository;

import canteenManagment.main.UserEntity.TimesheetEntry;

public interface TimesheetRepository extends MongoRepository<TimesheetEntry, Long> {}

