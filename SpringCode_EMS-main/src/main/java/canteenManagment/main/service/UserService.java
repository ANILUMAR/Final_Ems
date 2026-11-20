package canteenManagment.main.service;


import org.springframework.cache.Cache;
import org.springframework.cache.Cache.ValueWrapper;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;

import canteenManagment.main.DTO.BulkRegisterRequest;
import canteenManagment.main.DTO.UserDetailsDTO;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.reference.ReferenceService;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.PasswordCipher;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.UserRepository;
import io.jsonwebtoken.io.IOException;

@Service
public class UserService {

    private final UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private CacheManager cacheManager;

    /** Writes the encrypted review copy of every password this service stores. */
    @Autowired
    private PasswordCipher passwordCipher;

    /** The role list now lives in MongoDB (app_lookup), not in this class. */
    @Autowired
    private ReferenceService referenceService;
    
    @Value("${file.upload-dir1}")
    private String pathDirectory;

    public UserService(UserRepository userRepository, CacheManager cacheManager) {
        this.userRepository = userRepository;
        this.cacheManager=cacheManager;
    }

    /**
     * Writes both copies of a password: the BCrypt hash that the security layer
     * verifies, and the encrypted review copy that the Edit employee dialog can
     * show back to an administrator. Call this instead of encoding by hand, so
     * the two can never disagree.
     */
    public void storePassword(UserEntity user, String rawPassword) {
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setEncryptedPassword(passwordCipher.encrypt(rawPassword));
    }

    /**
     * The saved password in readable form, for the admin Edit employee dialog.
     *
     * @return an empty string when the row carries no readable copy - accounts
     *         whose password was last set before the review copy existed, or a
     *         copy written with a different secret. Never throws: the dialog
     *         falls back to "set a new password" instead of failing to open.
     */
    public String passwordForReview(Long userId) {
        return userRepository.findById(userId)
                .map(UserEntity::getEncryptedPassword)
                .map(passwordCipher::decrypt)
                .orElse("");
    }

    @CachePut(value = "usersByEmail", key = "#result.email")
    public UserEntity saveUser(UserEntity user,MultipartFile imageFile) throws IllegalStateException, java.io.IOException {
    	java.util.Date utilDate = new java.util.Date();
		 java.util.Date storedDate = new java.util.Date(utilDate.getTime());
		 // Capture the raw value first: storePassword() replaces it with the hash.
		 storePassword(user, user.getPassword());
    	 user.setGeneratedDate(storedDate);
    	// Keep the name as the person writes it ("Raju Kumar", not "raju kumar");
    	// lowerName stays the normalised key for case-insensitive matching.
    	 String displayName = user.getName() == null ? "" : user.getName().trim();
    	 user.setName(displayName);
    	 user.setLowerName(displayName.toLowerCase(Locale.ROOT));
    	// MultipartFile imageFile=user.getAttachment();
    	 
    	 if (imageFile != null && !imageFile.isEmpty()) {
    	        try {
    	        	
    	        	
    	            File dir = new File(pathDirectory);
    	            if (!dir.exists()) {
    	                dir.mkdirs();
    	            }
    	            
    	            String email = user.getEmail();
    	            String emailPrefix = (email != null && email.contains("@")) ? email.substring(0, email.indexOf('@')) : "user";

    	            // Get original file extension
    	            String originalFilename = imageFile.getOriginalFilename();
    	            String extension = "";
    	            if (originalFilename != null && originalFilename.contains(".")) {
    	                extension = originalFilename.substring(originalFilename.lastIndexOf('.'));
    	            }

    	            // Create new filename: e.g., anilkumar.jpg
    	            //String fileName = emailPrefix + "_" + UUID.randomUUID() + extension;
    	            String fileName = emailPrefix+extension;

    	            // Save the file
    	            File destFile = new File(dir, fileName);
    	            imageFile.transferTo(destFile);

    	            // Save relative path or filename in DB
    	            user.setRegisterImage(fileName); 
    	            
    	            

    	        } catch (IOException e) {
    	            throw new RuntimeException("Failed to save image", e);
    	        }
    	    }
          
    	 
         UserEntity savedUser = userRepository.save(user);
         System.out.println("✅ User saved to database and cache with ID: " + savedUser.getId());
        return savedUser;
    }
    
    @Cacheable(value = "usersByEmail", key = "#email")
    public UserEntity getUserByEmail(String email) {
        System.out.println("🔍 Fetching user from DB for email: " + email);
        return userRepository.findByEmail(email).orElse(null);
    }
    
    @Cacheable(value = "users", key = "#id")
    public UserEntity getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
    
    @CacheEvict(value = "usersByEmail", key = "#email")
    public void deleteUserByEmail(String email) {
        userRepository.deleteByEmail(email);
        System.out.println(" User deleted from DB and cache for email: " + email);
    }
    
    
    public void checkCache(String email) {
        Cache cache = (Cache) cacheManager.getCache("usersByEmail");
        if (cache != null) {
            ValueWrapper wrapper = cache.get(email);
            if (wrapper != null) {
                System.out.println("✅ Found in cache: " + wrapper.get());
            } else {
                System.out.println("❌ Not found in cache.");
            }
        }
    }
    
    public ResponseEntity<List<UserEntity>> getAllEmployees() {
	    List<UserEntity> employees = userRepository.findAll();
	    // 40+ accounts arrive in insertion order from Mongo; the directory reads
	    // better sorted by the name people actually search for.
	    employees.sort((a, b) -> String.valueOf(a.getName()).compareToIgnoreCase(String.valueOf(b.getName())));
	    return ResponseEntity.ok(employees);
	}
    
    public UserDetailsDTO getUserDetailsByUsername(String username) {
        Optional<UserEntity> userOpt = userRepository.findByEmail(username);
        if (userOpt.isPresent()) {
        	UserEntity user = userOpt.get();
            return new UserDetailsDTO(
                user.getName(),
                user.getEmail(),
                user.getName(),
                user.getRole(),
                user.getRegisterImage(),
                user.getPhoneNumber(),
                user.getAddress()
            );
        }
        return null;
    }
    
    public Integer getAllEmployeesCount()
    {
    	return (int) userRepository.count();
    }

    /**
     * The identities a new account can be given, in the order the dropdown
     * shows them. The words come from app_lookup, so renaming a role needs no
     * deploy; the legacy ADMIN code is filtered out because it is only the old
     * name for SUPER_ADMIN and must never be handed out again.
     */
    public List<String> getRoles() {
        return referenceService.codes(ReferenceService.ROLE).stream()
                .filter(Roles::isAssignable)
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Switches an account between active and inactive. Deactivating is the
     * alternative to deleting somebody who has left: their tasks, hours and
     * audit history stay intact, they just cannot sign in any more.
     */
    @CachePut(value = "usersByEmail", key = "#result.email")
    public UserEntity setStatus(Long userId, boolean active, String actorEmail) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Account " + userId + " does not exist."));

        if (!active) {
            if (isSamePerson(actorEmail, user)) {
                throw new IllegalArgumentException("You cannot deactivate your own account.");
            }
            if (isAdmin(user) && activeAdminCount() <= 1) {
                throw new IllegalArgumentException("Keep at least one active administrator.");
            }
        }

        user.setActive(active);
        UserEntity saved = userRepository.save(user);
        System.out.println("✅ Account " + (active ? "activated" : "deactivated") + ": " + saved.getEmail());
        return saved;
    }

    /**
     * Who may create, edit and delete tasks. The CEO and both team leaders hold
     * the right by their role alone - running the work is what a leader is for.
     * A tester holds it only while an administrator keeps the task-management
     * provision switched on for that account, and a developer never does.
     */
    public boolean canManageTasks(Authentication authentication) {
        if (AuthContext.isManager(authentication)) {
            return true;
        }
        if (!AuthContext.hasRole(authentication, AuthContext.ROLE_TESTER)) {
            return false;
        }
        return userRepository.findByEmailIgnoreCase(AuthContext.email(authentication))
                .map(user -> Boolean.TRUE.equals(user.getTaskManager()))
                .orElse(false);
    }

    /** Grants or revokes the task-management provision; testers only. */
    public UserEntity setTaskAccess(Long userId, boolean enabled) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Account " + userId + " does not exist."));
        if (!mayHoldProvision(user)) {
            throw new IllegalArgumentException(
                    "Task access applies to testers. A team leader already holds it, and a developer never does.");
        }
        user.setTaskManager(enabled);
        UserEntity saved = userRepository.save(user);
        System.out.println("✅ Task access " + (enabled ? "granted to " : "revoked from ") + saved.getEmail());
        return saved;
    }

    /**
     * Who may add, rename and retire module / sub module / screen master data:
     * the CEO, and only the CEO. Mapping the product is administrative work, so
     * neither team curates the vocabulary - testers report against it and
     * developers build against it.
     */
    public boolean canEditMasters(Authentication authentication) {
        return AuthContext.isSuperAdmin(authentication);
    }

    /**
     * The two provisions are levers inside the tester role. A team leader holds
     * both by being one, and a developer can never be given either, so there is
     * nothing to switch.
     */
    private boolean mayHoldProvision(UserEntity user) {
        return Roles.FAMILY_TESTER.equals(Roles.family(user.getRole())) && !Roles.isTesterLead(user.getRole());
    }

    /**
     * Creates every row the admin pasted into the onboarding screen. Rows are
     * processed independently: one bad or duplicated email never blocks the
     * other 39 people, and the reply says which row was skipped and why.
     */
    public Map<String, Object> registerMany(List<BulkRegisterRequest.Row> rows) {
        List<Map<String, Object>> created = new ArrayList<>();
        List<Map<String, String>> skipped = new ArrayList<>();

        for (BulkRegisterRequest.Row row : rows) {
            String email = row.getEmail() == null ? "" : row.getEmail().trim().toLowerCase(Locale.ROOT);
            String name = row.getName() == null ? "" : row.getName().trim();
            String password = row.getPassword() == null ? "" : row.getPassword().trim();

            if (email.isEmpty() || !email.contains("@") || email.startsWith("@") || email.endsWith("@")) {
                skipped.add(bulkIssue(email, "not a valid email address"));
                continue;
            }
            if (name.isEmpty()) {
                skipped.add(bulkIssue(email, "name is required"));
                continue;
            }
            if (password.length() < 6) {
                skipped.add(bulkIssue(email, "password needs at least 6 characters"));
                continue;
            }
            if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
                skipped.add(bulkIssue(email, "an account already uses this email"));
                continue;
            }

            try {
                UserEntity user = new UserEntity();
                user.setEmail(email);
                user.setName(name);
                user.setLowerName(name.toLowerCase(Locale.ROOT));
                storePassword(user, password);
                user.setRole(normaliseRole(row.getRole()));
                user.setPhoneNumber(blankToNull(row.getPhoneNumber()));
                user.setAddress(blankToNull(row.getAddress()));
                user.setGeneratedDate(new Date());
                UserEntity saved = userRepository.save(user);

                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("id", saved.getId());
                entry.put("name", saved.getName());
                entry.put("email", saved.getEmail());
                entry.put("role", saved.getRole());
                created.add(entry);
            } catch (DuplicateKeyException e) {
                // Somebody registered the same address between the check and the save.
                skipped.add(bulkIssue(email, "an account already uses this email"));
            } catch (Exception e) {
                skipped.add(bulkIssue(email, "could not be saved: " + e.getMessage()));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("createdCount", created.size());
        result.put("skippedCount", skipped.size());
        result.put("created", created);
        result.put("skipped", skipped);
        return result;
    }

    /**
     * The value to store for a submitted role: one of the five identities, or
     * a developer when the value is empty or unknown.
     */
    private String normaliseRole(String role) {
        return Roles.normalise(role);
    }

    private String blankToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private Map<String, String> bulkIssue(String email, String reason) {
        Map<String, String> issue = new LinkedHashMap<>();
        issue.put("email", email);
        issue.put("reason", reason);
        return issue;
    }
    
    
    @CachePut(value = "usersByEmail", key = "#result.email")
    public UserEntity updateUser(
            Long userId,
            UserEntity userUpdates,
            MultipartFile imageFile,
            String actorEmail
    ) throws IllegalStateException, IOException, java.io.IOException {
    	
        UserEntity existingUser = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Update fields as needed:
        if (userUpdates.getName() != null && !userUpdates.getName().trim().isEmpty()) {
            String displayName = userUpdates.getName().trim();
            existingUser.setName(displayName);
            existingUser.setLowerName(displayName.toLowerCase(Locale.ROOT));
        }

        // The sign-in address. Changing it changes how this person logs in, so the
        // new value is normalised, must not belong to another account, and the
        // cached lookup under the OLD address is dropped - otherwise
        // getUserByEmail() would keep answering that key and the previous address
        // would still authenticate.
        if (userUpdates.getEmail() != null && !userUpdates.getEmail().trim().isEmpty()) {
            String email = userUpdates.getEmail().trim().toLowerCase(Locale.ROOT);
            if (!isValidEmail(email)) {
                throw new IllegalArgumentException("Enter a valid email address.");
            }
            String previousEmail = existingUser.getEmail();
            if (!email.equalsIgnoreCase(String.valueOf(previousEmail))) {
                Optional<UserEntity> taken = userRepository.findByEmailIgnoreCase(email);
                if (taken.isPresent() && !existingUser.getId().equals(taken.get().getId())) {
                    throw new IllegalArgumentException("Another account already uses " + email + ".");
                }
                existingUser.setEmail(email);
                evictUsersByEmail(previousEmail);
            }
        }

        // The role arrives from the dropdown that GET /api/auth/roles fills. The
        // five identities are part of the product, so the value is checked
        // against them - and the old ADMIN code is accepted and stored as its
        // new name, SUPER_ADMIN.
        if (userUpdates.getRole() != null && !userUpdates.getRole().trim().isEmpty()) {
            String submitted = userUpdates.getRole().trim().toUpperCase(Locale.ROOT);
            if (!Roles.isKnown(submitted)) {
                throw new IllegalArgumentException("Unknown role: " + userUpdates.getRole());
            }
            String role = Roles.normalise(submitted);
            if (!role.equals(Roles.normalise(existingUser.getRole()))) {
                // Losing the last admin (or demoting yourself) would leave the
                // workspace with nobody able to manage accounts.
                if (isSamePerson(actorEmail, existingUser)) {
                    throw new IllegalArgumentException("You cannot change your own role.");
                }
                if (isAdmin(existingUser) && activeAdminCount() <= 1) {
                    throw new IllegalArgumentException("Keep at least one administrator.");
                }
                existingUser.setRole(role);
                // The task provision is a lever inside the plain tester role, so
                // any move off it gives it up instead of lying dormant.
                if (!Roles.TESTER.equals(role)) {
                    existingUser.setTaskManager(Boolean.FALSE);
                }
            } else if (Roles.LEGACY_ADMIN.equals(Roles.raw(existingUser.getRole()))) {
                // Same identity, old spelling: rewrite it while we are saving the row.
                existingUser.setRole(role);
            }
        }

        // `active` is deliberately not read from this payload. It is a lifecycle
        // flag, not profile data: it changes only through setStatus(), so editing a
        // name or role can never switch an account back on. (Reading it here was a
        // trap anyway - UserEntity initialises the field to TRUE, so a PUT that
        // omitted it re-activated a switched-off account.)

        if (userUpdates.getAddress() != null) {
            existingUser.setAddress(userUpdates.getAddress());
        }

        if (userUpdates.getPhoneNumber() != null) {
            existingUser.setPhoneNumber(userUpdates.getPhoneNumber());
        }

        
        // The edit dialog can set a new login password. Blank means "keep the
        // current one", so an untouched form never rewrites the hash. The length
        // rule matches bulk onboarding (registerMany).
        if (userUpdates.getPassword() != null && !userUpdates.getPassword().trim().isEmpty()) {
            String newPassword = userUpdates.getPassword().trim();
            if (newPassword.length() < 6) {
                throw new IllegalArgumentException("Password needs at least 6 characters.");
            }
            storePassword(existingUser, newPassword);
        }

        // Handle image file
        if (imageFile != null && !imageFile.isEmpty()) {
            File dir = new File(pathDirectory);
            if (!dir.exists()) dir.mkdirs();

            String email = existingUser.getEmail();
            String emailPrefix = email != null && email.contains("@")
                ? email.substring(0, email.indexOf('@'))
                : "user";
            String originalFilename = imageFile.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : "";

            String fileName = emailPrefix + extension;
            File destFile = new File(dir, fileName);
            imageFile.transferTo(destFile);
            existingUser.setRegisterImage(fileName);
        }

        UserEntity updatedUser = userRepository.save(existingUser);
        System.out.println("✅ User updated: ID " + updatedUser.getId());
        return updatedUser;
    }
    
    @CachePut(value = "usersByEmail", key = "#result.email")
    public UserEntity updateUser1(UserDetailsDTO userUpdates,MultipartFile imageFile) throws IllegalStateException, IOException, java.io.IOException {
    	
        UserEntity existingUser = userRepository.findByEmail(userUpdates.getEmail())
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Update fields as needed:
        if (userUpdates.getFullName() != null && !userUpdates.getFullName().trim().isEmpty()) {
            String displayName = userUpdates.getFullName().trim();
            existingUser.setName(displayName);
            existingUser.setLowerName(displayName.toLowerCase(Locale.ROOT));
        }

        if (userUpdates.getRole() != null) {
            existingUser.setRole(userUpdates.getRole());
        }

        if (userUpdates.getAddress() != null) {
            existingUser.setAddress(userUpdates.getAddress());
        }

        if (userUpdates.getPhoneNumber() != null) {
            existingUser.setPhoneNumber(userUpdates.getPhoneNumber());
        }

        
        /*if (userUpdates.getPassword() != null && !userUpdates.getPassword().isEmpty()) {
            existingUser.setPassword(passwordEncoder.encode(userUpdates.getPassword()));
        }*/

        // Handle image file
        if (imageFile != null && !imageFile.isEmpty()) {
            File dir = new File(pathDirectory);
            if (!dir.exists()) dir.mkdirs();

            String email = existingUser.getEmail();
            String emailPrefix = email != null && email.contains("@")
                ? email.substring(0, email.indexOf('@'))
                : "user";
            String originalFilename = imageFile.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : "";

            String fileName = emailPrefix + extension;
            File destFile = new File(dir, fileName);
            imageFile.transferTo(destFile);
            existingUser.setRegisterImage(fileName);
        }

        UserEntity updatedUser = userRepository.save(existingUser);
        System.out.println("✅ User updated: ID " + updatedUser.getId());
        return updatedUser;
    }

    /** Loose check: one @, no spaces, and a dot in the domain part. */
    private boolean isValidEmail(String email) {
        return email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    }

    /** Forgets a sign-in lookup cached under an address that no longer exists. */
    private void evictUsersByEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return;
        }
        Cache cache = cacheManager.getCache("usersByEmail");
        if (cache != null) {
            cache.evict(email);
            // lookups are keyed by the address exactly as it was typed
            cache.evict(email.trim().toLowerCase(Locale.ROOT));
        }
    }

    /* ---------- account status helpers ---------- */

    /** True unless the record was explicitly switched off. */
    private boolean isActive(UserEntity user) {
        return !Boolean.FALSE.equals(user.getActive());
    }

    private boolean isAdmin(UserEntity user) {
        return Roles.isSuperAdmin(user.getRole());
    }

    private boolean isSamePerson(String actorEmail, UserEntity user) {
        return actorEmail != null && actorEmail.equalsIgnoreCase(String.valueOf(user.getEmail()));
    }

    private long activeAdminCount() {
        return userRepository.findAll().stream()
                .filter(user -> isAdmin(user) && isActive(user))
                .count();
    }
}
    
   
