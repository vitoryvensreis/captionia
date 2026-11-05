"""Access the real Caption IA licensing/Groq proxy without exposing BYOK keys."""
from __future__ import annotations

import json
import os
import platform
import threading
import uuid
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://caption.escotilhaprodutora.com/api/v1"
SERVICE = "CaptionIA.Desktop"
VERSION = "3.6.5"


class ApiError(RuntimeError):
    pass


def config_path() -> Path:
    if os.name == "nt":
        root = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(root) / "CaptionIA" / "Desktop" / "device.json"
    if platform.system() == "Darwin":
        return Path.home() / "Library" / "Application Support" / "CaptionIA" / "Desktop" / "device.json"
    return Path.home() / ".config" / "captionia-desktop" / "device.json"


def persistent_device_id() -> str:
    dest = config_path()
    try:
        obj = json.loads(dest.read_text(encoding="utf-8"))
        if isinstance(obj.get("uuid"), str) and 8 <= len(obj["uuid"]) <= 128:
            return obj["uuid"]
    except (OSError, ValueError, KeyError, TypeError):
        pass
    value = str(uuid.uuid4())
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"uuid": value}, indent=2), encoding="utf-8")
    if os.name != "nt":
        dest.chmod(0o600)
    return value


class CaptionApi:
    def __init__(self, base_url: str = BASE_URL, device_id: str | None = None):
        self.base_url = base_url.rstrip("/")
        if not self.base_url.startswith("https://") and self.base_url != "http://127.0.0.1":
            raise ApiError("A conexão com a plataforma exige HTTPS.")
        self.device_id = device_id or persistent_device_id()
        self.access_token = ""
        self.refresh_token = ""
        self.user: dict[str, Any] | None = None
        self.license: dict[str, Any] | None = None
        self._lock = threading.RLock()
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "CaptionIA-Desktop/1.0", "Accept": "application/json"})

    def _call(self, method: str, path: str, *, json_data: dict | None = None,
              files: dict | None = None, form: dict | None = None,
              authenticated: bool = True, timeout: int = 45, retry: bool = True) -> dict:
        headers = {}
        if authenticated:
            if not self.access_token:
                raise ApiError("Entre com sua conta Caption IA para continuar.")
            headers["Authorization"] = "Bearer " + self.access_token
        try:
            response = self._session.request(method, self.base_url + path, json=json_data,
                                             files=files, data=form, headers=headers,
                                             timeout=timeout, allow_redirects=False)
        except requests.RequestException as exc:
            raise ApiError("Não foi possível conectar à plataforma Caption IA. Verifique a internet.") from exc
        if response.status_code == 401 and authenticated and retry and self.refresh_token:
            self.refresh()
            if files:
                for _, filedef in files.items():
                    fileobj = filedef[1] if isinstance(filedef, tuple) else filedef
                    fileobj.seek(0)
            return self._call(method, path, json_data=json_data, files=files, form=form,
                              authenticated=authenticated, timeout=timeout, retry=False)
        try:
            data = response.json()
        except ValueError:
            raise ApiError(f"Resposta inválida da plataforma (HTTP {response.status_code}).")
        if not isinstance(data, dict):
            raise ApiError("Resposta não reconhecida da plataforma.")
        if not 200 <= response.status_code < 300 or data.get("ok") is False:
            message = str(data.get("error") or data.get("message") or "Solicitação recusada")
            raise ApiError(f"{message[:300]} (HTTP {response.status_code})")
        return data

    def _store_refresh(self, value: str) -> None:
        self.refresh_token = value
        try:
            import keyring
            keyring.set_password(SERVICE, self.device_id, value)
        except Exception:
            # Do not fall back to plaintext refresh tokens on disk.
            pass

    def restore(self) -> dict:
        try:
            import keyring
            token = keyring.get_password(SERVICE, self.device_id)
        except Exception:
            token = None
        if not token:
            raise ApiError("Nenhuma sessão anterior protegida foi encontrada.")
        self.refresh_token = token
        self.refresh()
        return self.check_account()

    def login(self, email: str, password: str) -> dict:
        if not email or not password:
            raise ApiError("Informe o e-mail e a senha.")
        result = self._call("POST", "/auth/login", json_data={
            "email": email.strip(), "password": password,
            "device_uuid": self.device_id,
            "device_name": f"Caption IA Desktop ({platform.node()[:70]})",
            "os": platform.system(),
        }, authenticated=False)
        self.access_token = str(result["access_token"])
        self._store_refresh(str(result["refresh_token"]))
        return self.check_account()

    def refresh(self) -> None:
        with self._lock:
            if not self.refresh_token:
                raise ApiError("Sessão expirada. Entre novamente.")
            result = self._call("POST", "/auth/refresh", json_data={
                "refresh_token": self.refresh_token, "device_uuid": self.device_id,
            }, authenticated=False)
            self.access_token = str(result["access_token"])
            self._store_refresh(str(result["refresh_token"]))

    def check_account(self) -> dict:
        info = self._call("GET", "/me")
        license_result = self._call("GET", f"/license/check?version={VERSION}")
        if not license_result.get("allowed"):
            raise ApiError("Sua licença não está ativa ou não cobre esta versão. Verifique em Minha conta.")
        self.user = info.get("user") or {}
        self.license = license_result.get("license") or {}
        groq = self._call("GET", "/groq/status")
        if not groq.get("connected"):
            raise ApiError("Sua conta não tem chave Groq. Configure em Minha conta no site.")
        return {"user": self.user, "license": self.license, "groq": groq}

    def check_license(self) -> None:
        result = self._call("GET", f"/license/check?version={VERSION}")
        if not result.get("allowed"):
            raise ApiError("Sua licença não permite processar este vídeo.")

    def transcribe(self, audio_file: Path, language: str = "pt") -> dict:
        with audio_file.open("rb") as fp:
            return self._call("POST", "/groq/transcription",
                              files={"file": ("audio.mp3", fp, "audio/mpeg")},
                              form={"language": language}, timeout=230)

    def narrative(self, segments: list[dict], objective: str) -> dict:
        payload = {
            "objective": "Construir montagem coerente somente com as falas gravadas, sem inventar conteúdo.",
            "instructions": objective[:1000],
            "requirements": [
                "Use somente IDs de segmentos recebidos; não invente falas nem timecodes.",
                "Preserve ideias essenciais; elimine erros de gravação, repetições e tentativas abandonadas.",
                "Retorne cuts: [{id, role, reason}] na ordem final, e summary.",
                "Se não houver certeza sobre um descarte, preserve o segmento.",
                "Não escolha segmentos blocked=true.",
            ],
            "segments": segments,
        }
        result = self._call("POST", "/groq/narrative/analyze", json_data={"messages": [
            {"role": "system", "content": "Especialista em edição de vídeos com falas, responda apenas JSON."},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]}, timeout=120)
        raw = result.get("result")
        if not isinstance(raw, dict):
            raise ApiError("A IA não retornou um plano de cortes válido.")
        return raw

    def logout(self) -> None:
        token = self.refresh_token
        self.access_token = ""
        self.refresh_token = ""
        self.user = self.license = None
        try:
            import keyring
            keyring.delete_password(SERVICE, self.device_id)
        except Exception:
            pass
        if token:
            try:
                self._call("POST", "/auth/logout", json_data={"refresh_token": token},
                           authenticated=False, timeout=10)
            except ApiError:
                pass