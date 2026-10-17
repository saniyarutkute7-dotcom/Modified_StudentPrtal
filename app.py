import os
from flask import Flask, send_from_directory, abort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
ALLOWED_STATIC = (".js", ".css", ".png", ".jpg", ".jpeg", ".json", ".ico")

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)

# Keep the existing frontend code unchanged. HTML files are stored in
# templates/, while existing relative links such as "portal.js" and
# "college.jpg" continue to work through these compatibility routes.
@app.route("/")
def index():
    return send_from_directory(TEMPLATES_DIR, "index.html")

@app.route("/<path:filename>")
def site_files(filename):
    # Existing HTML links continue to resolve from the project root.
    if filename.lower().endswith(".html"):
        full = os.path.join(TEMPLATES_DIR, filename)
        if os.path.isfile(full):
            return send_from_directory(TEMPLATES_DIR, filename)
        abort(404)

    # Existing JS/CSS/image/manifest/service-worker links continue to resolve
    # from the project root even though the actual files live in static/.
    if filename.lower().endswith(ALLOWED_STATIC) or filename == "sw.js":
        full = os.path.join(STATIC_DIR, filename)
        if os.path.isfile(full):
            return send_from_directory(STATIC_DIR, filename)
        abort(404)

    abort(404)

if __name__ == "__main__":
    app.run(debug=True)
