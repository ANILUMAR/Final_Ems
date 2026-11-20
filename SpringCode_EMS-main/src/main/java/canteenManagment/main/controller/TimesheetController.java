package canteenManagment.main.controller;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import canteenManagment.main.UserEntity.TimesheetEntry;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.reference.ReferenceService;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.service.TimesheetService;
import canteenManagment.main.userReposerity.UserRepository;

@RestController
@RequestMapping("/api/timesheets")
public class TimesheetController {

    @Autowired
    private TimesheetService service;

    /** Approval states are rows in app_lookup, so the list is not compiled in. */
    @Autowired
    private ReferenceService referenceService;
    
    /** The roster behind a team leader's hours: entries store the owner as text. */
    @Autowired
    private UserRepository userRepository;
    
    /**
     * The CEO sees every entry. A team leader sees the hours their own family
     * logged - the developers or the testers - so a team board can show real
     * hours per person. Everybody else only ever sees their own rows.
     */
    @GetMapping
    public List<TimesheetEntry> getAll(Authentication authentication) {
        List<TimesheetEntry> entries = service.getAll();
    
        if (AuthContext.isAdmin(authentication)) {
            return entries;
        }
    
        Set<String> owners = AuthContext.isLead(authentication)
                ? familyOwners(AuthContext.email(authentication))
                : Collections.singleton(AuthContext.email(authentication).toLowerCase(Locale.ROOT));
    
        return entries.stream()
                .filter(entry -> entry.getEmployeeName() != null
                        && owners.contains(entry.getEmployeeName().trim().toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }
    
    /** The emails and display names of everybody in the caller's job family. */
    private Set<String> familyOwners(String email) {
        Optional<UserEntity> caller = userRepository.findByEmailIgnoreCase(email);
        String family = caller.map(user -> Roles.family(user.getRole())).orElse("");
        if (family.isEmpty()) {
            return Collections.emptySet();
        }
        return userRepository.findAll().stream()
                .filter(user -> family.equals(Roles.family(user.getRole())))
                .flatMap(user -> Stream.of(user.getEmail(), user.getName()))
                .filter(Objects::nonNull)
                .map(owner -> owner.trim().toLowerCase(Locale.ROOT))
                .filter(owner -> !owner.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * A non-admin always books hours against their own account, so a tampered
     * payload cannot log time for somebody else.
     */
    @PostMapping
    public TimesheetEntry save(@RequestBody TimesheetEntry entry, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            entry.setEmployeeName(AuthContext.email(authentication));
        }
        entry.setId(null);
        entry.setStatus(resolveStatus(entry.getStatus()));
        return service.save(entry);
    }

    /**
     * Accepts only a live approval state and stores it in its canonical form.
     * A blank value falls back to the first state in the list, which is the
     * "awaiting approval" row.
     */
    private String resolveStatus(String requested) {
        String value = requested == null ? "" : requested.trim();
        if (!value.isEmpty()) {
            if (!referenceService.isActiveCode(ReferenceService.TIMESHEET_STATUS, value)) {
                throw new IllegalArgumentException("Unknown timesheet status: " + requested);
            }
            return value.toUpperCase(Locale.ROOT);
        }
        List<String> codes = referenceService.codes(ReferenceService.TIMESHEET_STATUS);
        return codes.isEmpty() ? null : codes.get(0);
    }
}
