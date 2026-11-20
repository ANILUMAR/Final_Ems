package canteenManagment.main.reference;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LookupRepository extends MongoRepository<LookupItem, String> {

    /** What a picker renders: live values only, in their configured order. */
    List<LookupItem> findByCategoryAndActiveTrueOrderBySortOrderAscLabelAsc(String category);

    /** Everything live, grouped by the caller - used by the bulk endpoint. */
    List<LookupItem> findByActiveTrueOrderByCategoryAscSortOrderAscLabelAsc();

    List<LookupItem> findByCategoryOrderBySortOrderAsc(String category);

    Optional<LookupItem> findByCategoryAndCodeIgnoreCase(String category, String code);
}
