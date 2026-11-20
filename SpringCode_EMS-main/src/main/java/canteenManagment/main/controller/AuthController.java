package canteenManagment.main.controller;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import canteenManagment.main.DTO.AccountStatusRequest;
import canteenManagment.main.DTO.BulkRegisterRequest;
import canteenManagment.main.DTO.TaskAccessRequest;
import canteenManagment.main.UserEntity.Translation;
import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.jwt.JwtUtil;
import canteenManagment.main.security.AuthContext;
import canteenManagment.main.security.Roles;
import canteenManagment.main.service.SmsService;
import canteenManagment.main.service.UserService;
import canteenManagment.main.userReposerity.TranslationRepository;
import canteenManagment.main.userReposerity.UserRepository;

@CrossOrigin
@RestController
@RequestMapping("/api/auth")
public class AuthController {
	 
	private final UserRepository userRepository;
	private final AuthenticationManager authenticationManager;
	private final PasswordEncoder passwordEncoder;
	private final UserService userService;
	private final SmsService smsService;
	private final TranslationRepository translationRepository;
    
    public AuthController(PasswordEncoder passwordEncoder, UserRepository userRepository , AuthenticationManager authenticationManager , UserService userService,SmsService smsService,TranslationRepository translationRepository) {
        this.userRepository = userRepository;
        this.authenticationManager= authenticationManager;
		this.passwordEncoder = passwordEncoder;
		this.userService = userService; 
		this.smsService = smsService;
		this.translationRepository= translationRepository;
    }
    private final JwtUtil jwtUtil = new JwtUtil();
	
    @PostMapping("/register")
    @CrossOrigin
	 public ResponseEntity<Map<String, String>> register(@RequestPart("user") UserEntity user,@RequestPart(value = "file", required = false) MultipartFile file,  @RequestParam(defaultValue = "en") String lang) {
        Map<String, String> response = new HashMap<>();
        try {
            // The register page is public, so it may never mint the CEO or a
            // team leader: only an existing administrator can hand those out
            // from the accounts screen.
            user.setRole(Roles.TESTER.equals(Roles.normalise(user.getRole()))
                    ? Roles.TESTER
                    : Roles.EMPLOYEE);

            // Emails are stored lower case so sign-in does not depend on how the
            // address was typed, and one address can only ever own one account.
            String email = user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase(Locale.ROOT);
            if (email.isEmpty() || !email.contains("@")) {
                response.put("error", "A valid email address is required");
                return ResponseEntity.badRequest().body(response);
            }
            if (user.getName() == null || user.getName().trim().isEmpty()) {
                response.put("error", "Name is required");
                return ResponseEntity.badRequest().body(response);
            }
            if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
                response.put("error", "An account with this email already exists");
                return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }
            user.setEmail(email);
            // A new account always starts active; only the admin screen may
            // switch somebody off.
            user.setActive(true);

            userService.saveUser(user,file);
            List<Translation> translations = translationRepository.findByScreenNameAndLanguage("register", lang);
            Map<String, String> translationMap = translations.stream()
                .collect(Collectors.toMap(Translation::getKey, Translation::getValue));
            String body = translationMap.getOrDefault("register.success.sms",  "Hello " + user.getName() + ",\n\nYour registration was successful.\n\nThank you,\nCanteen Management Team");
            smsService.sendSms(user.getPhoneNumber(), body);
            response.put("message", translationMap.getOrDefault("register.success.api", 
                    "User registered and SMS sent successfully"));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("error", "Registration failed");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    /**
     * Onboards a batch of people (the admin "Bulk onboard" screen) in one call.
     * Each row is validated and saved independently so one typo does not stop
     * the rest of the team from being created.
     */
    @PostMapping("/bulk-register")
    public ResponseEntity<?> bulkRegister(@RequestBody BulkRegisterRequest request, Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only an administrator can onboard employees");
        }
        if (request == null || request.getUsers() == null || request.getUsers().isEmpty()) {
            return ResponseEntity.badRequest().body("Paste at least one employee row");
        }
        if (request.getUsers().size() > 200) {
            return ResponseEntity.badRequest().body("Please onboard at most 200 people per batch");
        }
        return ResponseEntity.ok(userService.registerMany(request.getUsers()));
    }

    @DeleteMapping("/delete")
    public ResponseEntity<Map<String, String>> deleteUser(@RequestParam String email) {
        Map<String, String> response = new HashMap<>();
        try {
            userService.deleteUserByEmail(email);
            response.put("message", "User deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", "Failed to delete user");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }


    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
             SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwtToken = jwtUtil.generateToken(request.getEmail());
            // Emails are stored lower case; fall back to the tolerant query so a
            // legacy mixed-case row still signs in.
            String email = request.getEmail() == null ? "" : request.getEmail().trim();
            Optional<UserEntity> found = userRepository.findByEmail(email.toLowerCase(Locale.ROOT));
            if (found.isEmpty()) {
                found = userRepository.findByEmailIgnoreCase(email);
            }
            UserEntity user = found.orElseThrow(() -> new IllegalStateException("User not found"));
            AuthResponse response = new AuthResponse(jwtToken, user);  
            return ResponseEntity.ok(response);
        } catch (DisabledException e) {
            // Right password, but an administrator has switched the account off.
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("This account is inactive. Ask an administrator to re-enable it.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }
    }   
    
    @GetMapping("/check-cache")
    public void checkUserCache(@RequestParam String email) {
        userService.checkCache(email);
    }
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request, Authentication authentication) {
        // Self-service reset is fine; resetting somebody else's password (and so
        // taking over their account) stays an admin-only operation.
        if (!AuthContext.isAdmin(authentication)
                && !AuthContext.email(authentication).equalsIgnoreCase(String.valueOf(request.getEmail()))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("You can only reset your own password");
        }

        Optional<UserEntity> optionalUser = userRepository.findByEmail(request.getEmail());

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Email not found");
        }

        UserEntity user = optionalUser.get(); 
        userService.storePassword(user, request.getNewPassword());
        userRepository.save(user);

        return ResponseEntity.ok("Password has been reset successfully.");
    }
    
    @GetMapping("/registredEmployees")
	public ResponseEntity<List<UserEntity>> getAllEmployees() {
	    return (ResponseEntity<List<UserEntity>>) userService.getAllEmployees();
	}

    /**
     * The roster a team board needs to show its own people: name, address, role
     * and whether the account is on. Deliberately narrower than
     * {@code /registredEmployees}, whose rows are the raw account entity with
     * the password fields - that one stays CEO-only. A team leader reads this
     * instead, which is why it is guarded by {@code isManager} rather than
     * {@code hasRole("ADMIN")}.
     */
    @GetMapping("/team-members")
    public ResponseEntity<?> teamMembers(Authentication authentication) {
        if (!AuthContext.isManager(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only a super admin or a team leader can open a team board.");
        }
        List<Map<String, Object>> people = userRepository.findAll().stream()
                .sorted(Comparator.comparing(
                        user -> String.valueOf(user.getName()), String.CASE_INSENSITIVE_ORDER))
                .map(user -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", user.getId());
                    row.put("name", user.getName());
                    row.put("email", user.getEmail());
                    row.put("role", user.getRole());
                    row.put("active", user.getActive());
                    return row;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(people);
    }
    
    @GetMapping("/totalEmployees")
	public ResponseEntity<Integer> getAllEmployeesCount() {
    	Integer count = userService.getAllEmployeesCount();
        return ResponseEntity.ok(count);
	}
    
    
    @PutMapping("/users/{id}")
    @CrossOrigin
    public ResponseEntity<Map<String, String>> update(
            @PathVariable Long id,
            @RequestPart("user") UserEntity user,
            @RequestPart(value = "file", required = false) MultipartFile file,
            Authentication authentication
    ) 
    {
        Map<String, String> response = new HashMap<>();
        try {
            UserEntity updatedUser = userService.updateUser(id, user, file, AuthContext.email(authentication));
            // Optionally, send SMS notifications:
            response.put("message", "User updated successfully");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // Unknown role, self-demotion, last admin... the admin needs the
            // reason, not a generic 500.
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("error", "Update failed");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /** Roles the edit dialog offers - the dropdown is filled from this list. */
    @GetMapping("/roles")
    public ResponseEntity<List<String>> roles() {
        return ResponseEntity.ok(userService.getRoles());
    }

    /**
     * The saved password in readable form, for the Edit employee dialog.
     *
     * <p>Admin only - {@code /api/auth/users/**} is {@code hasRole("ADMIN")} in
     * SecurityConfig. One record per request, so the plaintext never rides along
     * with the account list. The value comes back empty when the row has no
     * readable copy; the dialog then asks the admin to set a new password.
     */
    @GetMapping("/users/{id}/password")
    public ResponseEntity<Map<String, String>> revealPassword(@PathVariable Long id) {
        Map<String, String> response = new HashMap<>();
        response.put("password", userService.passwordForReview(id));
        return ResponseEntity.ok(response);
    }

    /**
     * Activates or deactivates an account. Deactivating keeps the person's
     * tasks, hours and history but blocks every future sign-in, including a
     * token that was issued before the switch was flipped.
     */
    @PatchMapping("/users/{id}/status")
    public ResponseEntity<?> setStatus(@PathVariable Long id,
                                       @RequestBody AccountStatusRequest request,
                                       Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only an administrator can change account status");
        }
        if (request == null || request.getActive() == null) {
            return ResponseEntity.badRequest().body("Send active=true or active=false");
        }

        try {
            UserEntity updated = userService.setStatus(id, request.getActive(), AuthContext.email(authentication));
            Map<String, Object> body = new HashMap<>();
            body.put("id", updated.getId());
            body.put("name", updated.getName());
            body.put("email", updated.getEmail());
            body.put("role", updated.getRole());
            body.put("active", updated.getActive());
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            boolean missing = String.valueOf(e.getMessage()).startsWith("Account ");
            return ResponseEntity.status(missing ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Grants or revokes the tester task-management provision. Only a tester can
     * hold it: developers keep their own-board workflow, and admins already have
     * every task right.
     */
    @PatchMapping("/users/{id}/task-access")
    public ResponseEntity<?> setTaskAccess(@PathVariable Long id,
                                           @RequestBody TaskAccessRequest request,
                                           Authentication authentication) {
        if (!AuthContext.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only an administrator can change task access");
        }
        if (request == null || request.getEnabled() == null) {
            return ResponseEntity.badRequest().body("Send enabled=true or enabled=false");
        }

        try {
            UserEntity updated = userService.setTaskAccess(id, request.getEnabled());
            Map<String, Object> body = new HashMap<>();
            body.put("id", updated.getId());
            body.put("name", updated.getName());
            body.put("email", updated.getEmail());
            body.put("role", updated.getRole());
            body.put("taskManager", updated.getTaskManager());
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            boolean missing = String.valueOf(e.getMessage()).startsWith("Account ");
            return ResponseEntity.status(missing ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

}