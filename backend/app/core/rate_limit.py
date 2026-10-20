"""Rate limiting configuration using slowapi.
Protects sensitive routes like authentication against brute force and credential stuffing attacks.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Tracks requests per IP address
limiter = Limiter(key_func=get_remote_address)
