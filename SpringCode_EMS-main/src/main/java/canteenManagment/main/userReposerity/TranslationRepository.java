package canteenManagment.main.userReposerity;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import canteenManagment.main.UserEntity.Translation;
import org.springframework.data.repository.query.Param;

@Repository
public interface TranslationRepository extends MongoRepository<Translation, Long> {
    List<Translation> findByLanguage(String langCode);

    // Derived from the property names; the old JPQL body is not needed.
    List<Translation> findByScreenNameAndLanguage(@Param("screen") String screen, @Param("lang") String lang);
}

