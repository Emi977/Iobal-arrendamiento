from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from jose import JWTError

security = HTTPBearer()

class TokenPayload:
    def __init__(self, usuario_id, rol):
        self.usuario_id = usuario_id
        self.rol = rol

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        p = decode_token(creds.credentials)
        return TokenPayload(int(p["sub"]), p["rol"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido o expirado",
                            headers={"WWW-Authenticate": "Bearer"})

def require_ti(me: TokenPayload = Depends(get_current_user)):
    if me.rol != "ti":
        raise HTTPException(status_code=403, detail="Se requiere rol de TI")
    return me

def require_admin(me: TokenPayload = Depends(get_current_user)):
    if me.rol not in ("admin", "ti"):
        raise HTTPException(status_code=403, detail="Se requiere rol de admin")
    return me

def require_admin_o_propietario(me: TokenPayload = Depends(get_current_user)):
    if me.rol not in ("admin", "propietario", "ti"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    return me
