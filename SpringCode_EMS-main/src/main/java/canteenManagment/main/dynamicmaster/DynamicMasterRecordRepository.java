package canteenManagment.main.dynamicmaster;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DynamicMasterRecordRepository extends MongoRepository<DynamicMasterRecord, Long> {

    List<DynamicMasterRecord> findByScreenCodeAndActiveTrueOrderByIdDesc(String screenCode);

    Page<DynamicMasterRecord> findByScreenCodeAndActiveTrue(String screenCode, Pageable pageable);

    Optional<DynamicMasterRecord> findByIdAndScreenCode(Long id, String screenCode);

    long countByScreenCodeAndActiveTrue(String screenCode);

    void deleteByScreenCode(String screenCode);
}
