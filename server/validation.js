/**
 * Validation rules for Umaira Florist Customer Registration & Authentication
 * Strictly validates:
 * 1. Full Name (required, non-empty, meaningful text)
 * 2. Mobile / Contact Number (required, Philippine mobile format)
 * 3. Email Address (required, valid email format)
 * 4. Password (required, at least 8 characters)
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateFullName(name) {
  if (name == null || typeof name !== 'string') {
    return { valid: false, error: 'Please enter your full name.' };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Full name cannot be empty or contain only spaces.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters long.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Full name cannot exceed 100 characters.' };
  }
  // Must contain letters
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return { valid: false, error: 'Full name must contain letters.' };
  }
  return { valid: true, value: trimmed };
}

function validatePhilippineMobile(phone) {
  if (phone == null || typeof phone !== 'string') {
    return { valid: false, error: 'Mobile / contact number is required.' };
  }
  const trimmed = phone.trim();
  if (!trimmed) {
    return { valid: false, error: 'Mobile / contact number cannot be empty or contain only spaces.' };
  }

  // Strip spaces, dashes, parentheses
  const digitsOnly = trimmed.replace(/\D/g, '');

  let normalized = '';
  if (/^09\d{9}$/.test(digitsOnly)) {
    normalized = digitsOnly; // e.g. 09171234567
  } else if (/^639\d{9}$/.test(digitsOnly)) {
    normalized = '0' + digitsOnly.slice(2); // normalize 63917... to 0917...
  } else if (/^9\d{9}$/.test(digitsOnly)) {
    normalized = '0' + digitsOnly; // normalize 917... to 0917...
  } else {
    return {
      valid: false,
      error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).'
    };
  }

  return { valid: true, value: normalized };
}

function validateEmail(email) {
  if (email == null || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, error: 'Email address cannot be empty or contain only spaces.' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. name@example.ph).' };
  }
  if (trimmed.length > 120) {
    return { valid: false, error: 'Email address is too long.' };
  }
  return { valid: true, value: trimmed };
}

function validatePassword(password) {
  if (password == null || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 200) {
    return { valid: false, error: 'Password cannot exceed 200 characters.' };
  }
  return { valid: true, value: password };
}

module.exports = {
  validateFullName,
  validatePhilippineMobile,
  validateEmail,
  validatePassword
};

