package canteenManagment.main.dynamicmaster;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DynamicFormSchemaRepository extends MongoRepository<DynamicFormSchema, Long> {

    Optional<DynamicFormSchema> findByScreenCode(String screenCode);

    List<DynamicFormSchema> findByActiveTrueOrderByScreenNameAsc();

    List<DynamicFormSchema> findByModuleAndActiveTrueOrderByScreenNameAsc(String module);

    boolean existsByScreenCode(String screenCode);
}
