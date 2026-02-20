from fastapi import FastAPI, Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TestOrbit Auth Target API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_bearer = HTTPBearer()
security_basic = HTTPBasic()

@app.get("/public")
def public_endpoint():
    return {"message": "Success! No auth required."}

@app.get("/bearer-auth")
def bearer_auth_endpoint(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    if credentials.credentials != "secret-token":
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return {"message": "Success! Bearer token accepted."}

@app.get("/basic-auth")
def basic_auth_endpoint(credentials: HTTPBasicCredentials = Depends(security_basic)):
    if credentials.username != "admin" or credentials.password != "password":
        raise HTTPException(status_code=401, detail="Invalid basic auth")
    return {"message": "Success! Basic auth accepted."}

@app.get("/api-key-auth")
def api_key_auth_endpoint(x_api_key: str = Header(None)):
    if x_api_key != "my-key":
        raise HTTPException(status_code=401, detail="Invalid API key")
    return {"message": "Success! API key accepted."}

class LoginInfo(BaseModel):
    username: str
    password: str

@app.post("/login")
def login_endpoint(info: LoginInfo):
    if info.username == "testuser" and info.password == "testpass":
        return {"data": {"token": "auto-auth-token-12345"}}
    raise HTTPException(status_code=401, detail="Invalid login credentials")

@app.get("/auto-auth-protected")
def auto_auth_protected(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    if credentials.credentials != "auto-auth-token-12345":
        raise HTTPException(status_code=401, detail="Invalid auto-auth token")
    return {"message": "Success! Auto-auth token accepted."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8111)
