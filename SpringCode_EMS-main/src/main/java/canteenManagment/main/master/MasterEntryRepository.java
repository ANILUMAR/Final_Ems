package canteenManagment.main.master;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * The master data rows. The lists are small (tens of entries), so the service
 * filters in memory rather than growing a query per screen.
 */
public interface MasterEntryRepository extends MongoRepository<MasterEntry, Long> {

    List<MasterEntry> findByTypeOrderBySortOrderAscNameAsc(String type);

    List<MasterEntry> findByTypeAndActiveTrueOrderBySortOrderAscNameAsc(String type);

    List<MasterEntry> findByParentId(Long parentId);

    Optional<MasterEntry> findByIdAndActiveTrue(Long id);
}
