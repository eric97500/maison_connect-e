"""À lancer une seule fois si ton compte Verisure a la double authentification :

    .venv\Scripts\python -m app.verisure_mfa

Un code est envoyé par SMS/e-mail ; une fois validé, un cookie de confiance est
enregistré dans data/verisure.cookie et le serveur se connecte ensuite sans code.
"""
import verisure

from .config import load_config
from .connectors.verisure import COOKIE_FILE


def main():
    c = load_config()["credentials"].get("verisure", {})
    s = verisure.Session(c.get("username", ""), c.get("password", ""), cookie_file_name=str(COOKIE_FILE))
    try:
        s.login()
        print("Connexion réussie sans double authentification : rien d'autre à faire.")
        return
    except verisure.LoginError as e:
        print(f"Double authentification demandée ({e}).")
    s.request_mfa()
    code = input("Code reçu par SMS / e-mail : ").strip()
    installations = s.validate_mfa(code)
    for inst in installations["data"]["account"]["installations"]:
        print(f"OK — installation {inst.get('alias')} (giid {inst['giid']})")
    print(f"Cookie enregistré dans {COOKIE_FILE}")


if __name__ == "__main__":
    main()
