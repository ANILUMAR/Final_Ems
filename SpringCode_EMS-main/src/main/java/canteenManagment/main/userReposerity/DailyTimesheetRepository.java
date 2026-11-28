package canteenManagment.main.userReposerity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import canteenManagment.main.UserEntity.DailyTimesheet;

public interface DailyTimesheetRepository extends MongoRepository<DailyTimesheet, String> {

    List<DailyTimesheet> findByEmployeeEmailIgnoreCaseOrderByWorkDateDesc(String employeeEmail);

    Optional<DailyTimesheet> findByWorkDateAndEmployeeEmailIgnoreCase(LocalDate workDate, String employeeEmail);

    List<DailyTimesheet> findByReportingPersonEmailIgnoreCaseOrderByWorkDateDesc(String reportingPersonEmail);

    List<DailyTimesheet> findByStatusIgnoreCase(String status);
}
