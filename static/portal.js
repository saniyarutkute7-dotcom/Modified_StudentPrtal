/*
 * Student Study Portal - shared authentication and student-specific storage.
 *
 * FLOW
 * 1. index.html uses the one common gate: student / 12345.
 * 2. login.html asks for each student's own username + password and personal data.
 * 3. The student's username becomes the unique account/data identifier.
 * 4. All existing localStorage-based features are automatically namespaced by
 *    that username, so one student cannot see another student's local data.
 * 5. Notes/Projects IndexedDB databases are also separated per username.
 */
(function () {
    "use strict";

    var ls = window.localStorage;
    var proto = Storage.prototype;
    var rawGet = proto.getItem;
    var rawSet = proto.setItem;
    var rawRemove = proto.removeItem;
    var rawClear = proto.clear;

    var GLOBAL_KEYS = {
        isLoggedIn: true,
        currentUser: true,
        gateAuthenticated: true,
        studentAccounts: true,
        students: true
    };

    function currentUser() {
        return rawGet.call(ls, "currentUser") || "";
    }

    function normalizeUsername(value) {
        return String(value || "").trim().toLowerCase();
    }

    function dataKey(key) {
        var user = currentUser();
        if (!user) return "guest:" + key;
        return "student:" + user + ":" + key;
    }

    /* Keep the existing project's localStorage calls working, but isolate them. */
    proto.getItem = function (key) {
        return this === ls && !GLOBAL_KEYS[key]
            ? rawGet.call(this, dataKey(key))
            : rawGet.call(this, key);
    };

    proto.setItem = function (key, value) {
        return this === ls && !GLOBAL_KEYS[key]
            ? rawSet.call(this, dataKey(key), value)
            : rawSet.call(this, key, value);
    };

    proto.removeItem = function (key) {
        return this === ls && !GLOBAL_KEYS[key]
            ? rawRemove.call(this, dataKey(key))
            : rawRemove.call(this, key);
    };

    /* ---------- IndexedDB isolation ---------- */
    if (window.IDBFactory && window.IDBFactory.prototype) {
        var idbProto = window.IDBFactory.prototype;
        var rawOpen = idbProto.open;
        var rawDelete = idbProto.deleteDatabase;

        function namespacedDbName(name) {
            var text = String(name);
            if (text.indexOf("StudentPortal") !== 0) return name;
            var user = currentUser();
            if (!user) return text + "__guest";
            return text + "__" + encodeURIComponent(user);
        }

        idbProto.open = function (name, version) {
            var dbName = namespacedDbName(name);
            return version === undefined
                ? rawOpen.call(this, dbName)
                : rawOpen.call(this, dbName, version);
        };

        idbProto.deleteDatabase = function (name) {
            return rawDelete.call(this, namespacedDbName(name));
        };
    }

    /* ---------- SHA-256 password hashing ---------- */
    function sha256(text) {
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            return window.crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(text)
            ).then(function (buffer) {
                return Array.prototype.map.call(
                    new Uint8Array(buffer),
                    function (byte) {
                        return ("0" + byte.toString(16)).slice(-2);
                    }
                ).join("");
            });
        }

        /* Compatibility fallback for older/local-file browsers. */
        var h1 = 2166136261;
        var h2 = 16777619;
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            h1 ^= c;
            h1 = Math.imul(h1, 16777619);
            h2 ^= (c + i);
            h2 = Math.imul(h2, 2246822519);
        }
        return Promise.resolve(
            "fallback-" +
            (h1 >>> 0).toString(16) + "-" +
            (h2 >>> 0).toString(16)
        );
    }

    function readAccounts() {
        try {
            return JSON.parse(rawGet.call(ls, "studentAccounts")) || {};
        } catch (e) {
            return {};
        }
    }

    function writeAccounts(accounts) {
        rawSet.call(ls, "studentAccounts", JSON.stringify(accounts));
    }

    function profileKey(username) {
        return "student:" + normalizeUsername(username) + ":studentData";
    }

    function getStudentProfile(username) {
        var user = normalizeUsername(username);
        if (!user) return null;
        try {
            return JSON.parse(rawGet.call(ls, profileKey(user))) || null;
        } catch (e) {
            return null;
        }
    }

    function saveStudentProfile(username, profile) {
        rawSet.call(
            ls,
            profileKey(username),
            JSON.stringify(profile)
        );
    }

    /* ---------- Common entrance gate ---------- */
    var COMMON_USERNAME = "student";
    var COMMON_PASSWORD = "12345";

    function commonLogin(username, password) {
        var suppliedUser = String(username || "").trim().toLowerCase();
        var suppliedPassword = String(password || "");

        if (suppliedUser !== COMMON_USERNAME || suppliedPassword !== COMMON_PASSWORD) {
            return Promise.resolve({ ok: false });
        }

        rawSet.call(ls, "gateAuthenticated", "true");
        rawRemove.call(ls, "isLoggedIn");
        rawRemove.call(ls, "currentUser");
        return Promise.resolve({ ok: true });
    }

    /* ---------- Individual student account ---------- */
    function loginOrCreateStudent(profile, username, password) {
        var user = normalizeUsername(username);
        var pass = String(password || "");

        if (!user || !pass) {
            return Promise.resolve({
                ok: false,
                error: "Please enter your username and password."
            });
        }

        if (rawGet.call(ls, "gateAuthenticated") !== "true") {
            return Promise.resolve({
                ok: false,
                error: "Please complete the common login first."
            });
        }

        return sha256("student-portal-account|" + user + "|" + pass)
            .then(function (passwordHash) {
                var accounts = readAccounts();
                var existing = accounts[user];

                if (existing && existing.passwordHash !== passwordHash) {
                    return {
                        ok: false,
                        error: "Incorrect username or password for this student account."
                    };
                }

                var oldProfile = getStudentProfile(user);
                var merged = oldProfile || {};

                Object.keys(profile || {}).forEach(function (key) {
                    var value = profile[key];
                    if (value !== undefined && value !== null && String(value).trim() !== "") {
                        merged[key] = String(value).trim();
                    }
                });

                merged.username = user;
                merged.name = merged.fullName || merged.name || "Student";

                /* New account: credentials are stored as a hash, not plaintext. */
                if (!existing) {
                    accounts[user] = {
                        username: user,
                        passwordHash: passwordHash,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    accounts[user].updatedAt = new Date().toISOString();
                }

                writeAccounts(accounts);
                saveStudentProfile(user, merged);

                rawSet.call(ls, "currentUser", user);
                rawSet.call(ls, "isLoggedIn", "true");

                var students = {};
                try {
                    students = JSON.parse(rawGet.call(ls, "students")) || {};
                } catch (e) {
                    students = {};
                }

                students[user] = {
                    username: user,
                    fullName: merged.fullName || "",
                    studentId: merged.studentId || "",
                    updatedAt: new Date().toISOString()
                };
                rawSet.call(ls, "students", JSON.stringify(students));

                return {
                    ok: true,
                    existing: !!oldProfile,
                    student: merged
                };
            });
    }

    function authenticateStudent(username, password) {
        var user = normalizeUsername(username);
        var pass = String(password || "");
        var accounts = readAccounts();
        var account = accounts[user];

        if (!account) {
            return Promise.resolve({
                ok: false,
                error: "Student account not found."
            });
        }

        return sha256("student-portal-account|" + user + "|" + pass)
            .then(function (hash) {
                if (hash !== account.passwordHash) {
                    return { ok: false, error: "Invalid username or password." };
                }

                var profile = getStudentProfile(user);
                if (!profile) {
                    return { ok: false, error: "Student information is missing." };
                }

                rawSet.call(ls, "currentUser", user);
                rawSet.call(ls, "isLoggedIn", "true");
                return { ok: true, student: profile };
            });
    }

    function logout() {
        rawRemove.call(ls, "isLoggedIn");
        rawRemove.call(ls, "currentUser");
        rawRemove.call(ls, "gateAuthenticated");
        /* IMPORTANT: no student:<username>:... data is deleted. */
    }

    window.Portal = {
        commonLogin: commonLogin,
        selectStudent: function (profile, username, password) {
            return loginOrCreateStudent(profile, username, password);
        },
        authenticateStudent: authenticateStudent,
        logout: logout,
        getCurrentStudentId: currentUser,
        getCurrentUsername: currentUser,
        getStudentProfile: getStudentProfile,
        loadStudentProfile: getStudentProfile,
        saveStudentProfile: saveStudentProfile,
        isLoggedIn: isValidSession,
        COMMON_USERNAME: COMMON_USERNAME,
        COMMON_PASSWORD: COMMON_PASSWORD
    };

    /* ---------- Page protection ---------- */
    var page = location.pathname.split("/").pop().toLowerCase();
    var publicPages = ["", "index.html", "login.html"];

    function isValidSession() {
        var loggedIn = rawGet.call(ls, "isLoggedIn") === "true";
        var user = currentUser();
        return loggedIn && !!user && !!getStudentProfile(user);
    }

    function enforceProtection() {
        var loggedIn = isValidSession();
        var gateOk = rawGet.call(ls, "gateAuthenticated") === "true";

        if (publicPages.indexOf(page) === -1 && !loggedIn) {
            location.replace("index.html");
            return;
        }

        if (page === "login.html" && !gateOk && !loggedIn) {
            location.replace("index.html");
        }
    }

    enforceProtection();

    window.addEventListener("pageshow", function (event) {
        /* A protected page restored from browser Back/Forward cache can contain
         * the previous student's rendered DOM. Force a fresh load after a
         * session transition so old student information cannot remain visible. */
        if (event && event.persisted && publicPages.indexOf(page) === -1) {
            if (!isValidSession()) {
                location.replace("index.html");
            } else {
                location.reload();
            }
            return;
        }
        enforceProtection();
    });

    window.addEventListener("popstate", function () {
        enforceProtection();
    });

    window.addEventListener("storage", function (event) {
        if (event.key === "isLoggedIn" || event.key === "currentUser" || event.key === "gateAuthenticated") {
            enforceProtection();
        }
    });
})();
