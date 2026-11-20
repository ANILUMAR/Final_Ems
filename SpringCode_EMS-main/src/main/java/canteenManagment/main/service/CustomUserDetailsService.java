package canteenManagment.main.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import canteenManagment.main.UserEntity.UserEntity;
import canteenManagment.main.security.Roles;
import canteenManagment.main.userReposerity.UserRepository;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;
    UserService userService;

    public CustomUserDetailsService(UserService userService) {
        this.userService = userService;
    }

    @Override
    public UserDetails loadUserByUsername(String name) throws UsernameNotFoundException {
	
    		UserEntity user ;
    	 	user = userService.getUserByEmail(name);
    	 	if( user == null) {
    	 	// Stored emails are lower case, so the exact (indexed) lookup answers
    	 	// almost every sign-in; the ignore-case query only covers legacy rows.
    	 	user = userRepository.findByEmail(name).orElse(null);
    	 	}
    	 	if( user == null) {
    	 	user = ((Optional<UserEntity>) userRepository.findByEmailIgnoreCase(name)).orElseThrow(() -> new UsernameNotFoundException("User not found"));
    	 	}
        // The role drives every access rule in SecurityConfig and in the
        // controllers, so it has to become a granted authority. Two are added:
        // the identity itself (SUPER_ADMIN, TESTER_LEAD, ...) and the family it
        // belongs to (ADMIN, EMPLOYEE, TESTER), which is what the older rules
        // were written against. The stored code is taken as it is, so a custom
        // value added to app_lookup keeps failing closed instead of silently
        // becoming a developer.
        String role = Roles.raw(user.getRole());
        if (role.isEmpty()) {
            role = Roles.EMPLOYEE;
        }
        ArrayList<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
        String family = Roles.family(role);
        if (!family.isEmpty() && !family.equals(role)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + family));
        }

        // active=false reaches the authentication manager as "disabled", so a
        // switched-off account fails sign-in with DisabledException even when
        // the password is correct.
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                !Boolean.FALSE.equals(user.getActive()),
                true,
                true,
                true,
                authorities
        );
    }
    
    
   
}