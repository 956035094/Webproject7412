/* Get Cookie; From W3Schools https://www.w3schools.com/js/js_cookies.asp */
function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}


/* Build Blog Post HTML */
function renderPost(postData){

    var postStructure = `
    <header class="post-header">
        <div class="post-meta-top">
            <span class="post-date">${new Date(postData.timestamp).toLocaleString("en-AU", {
                timeZone: "Australia/Adelaide",
                hour12: true
            })
        }</span>
        </div>
        <h2 class="post-title"></h2>
        <p class="post-meta">
            By <a class="post-author" href="mailto:${postData.author_email}">${postData.author_name}</a>
        </p>
    </header>
    <div class="post-body"><p></p></div>
    <div class="post-actions">

    <div class="reaction">
        <button class="reaction-btn like-btn" onclick="likePost(${postData.post_id})">
            👍
        </button>
        <span class="reaction-count" id="like-count-${postData.post_id}">
            ${postData.likes || 0}
        </span>
    </div>

    <div class="reaction">
        <button class="reaction-btn dislike-btn" onclick="dislikePost(${postData.post_id})">
            👎
        </button>
        <span class="reaction-count" id="dislike-count-${postData.post_id}">
            ${postData.dislikes || 0}
        </span>
    </div>

    </div>`;
    var post = document.createElement('SECTION');
    post.id = `post-${postData.post_id}`;
    post.className = "post card";
    post.innerHTML = postStructure;

    function filtering(input) {
        const newip = document.createElement('div');
        newip.innerHTML = input;
        return newip.textContent || newip.innerText || '';
    }
    post.querySelector('h2.post-title').innerText = filtering(postData.title);
    post.querySelector('div.post-body p').innerHTML = filtering(postData.content);

    if (postData.title &&
    (postData.title.startsWith('[System Alert]') ||
     postData.title.startsWith('[Covid-19 Infection Bulletin]'))) {
        post.classList.add('infection-alert');
    }

    return(post);

}

function setStatus(elementId, message, isError) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerText = message || '';
        el.style.color = isError ? 'red' : 'green';
    }
}

function updateNavByRole(role) {
    const anon = document.querySelector('.nav-list.anon');
    const user = document.querySelector('.nav-list.user');
    const admin = document.querySelector('.nav-list.admin');

    if (anon) anon.style.display = 'none';
    if (user) user.style.display = 'none';
    if (admin) admin.style.display = 'none';

    switch(role){
        case 'admin':
            if (admin) admin.style.display = 'block';
            break;
        case 'user':
            if (user) user.style.display = 'block';
            break;
        default:
            if (anon) anon.style.display = 'block';
    }
}

/* AJAX Load Blog Posts */
function loadPosts(){

    console.log("Load Post Data");

    const role = getCookie('role');
    updateNavByRole(role);
    const deleteBlock = document.querySelector('#delete');
    if (deleteBlock) {
        deleteBlock.style.display = role === "admin" ? 'block' : 'none';
    }

    fetch("/posts")
        .then(res => res.json())
        .then(data => {
            let container = document.querySelector('#posts');

            // Clear old posts
            let old_posts = document.querySelectorAll('section.post');
            for(let post of old_posts){
                container.removeChild(post);
            }

            // Display new posts
            for (let post of data) {
                container.appendChild(renderPost(post));
            }
        })
        .catch(() => {
            setStatus('delStatus', "Unable to load posts.", true);
        });

}

/* AJAX Submit New Blog Post */
function submitPost(){

    console.log("Submit Post");

    var blogPost = {
                        title: document.querySelector('#postTitle').value,
                        content: document.querySelector('#postBody').value
                    };

    fetch("/posts/new", {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify(blogPost)
    }).then(async res => {
        const data = await res.json().catch(()=>({}));
        if (res.status === 401) {
            setStatus('status', data.message || "Please log in.", true);
            window.location.pathname = "/login.html";
            return;
        }
        if (!res.ok || !data.ok) {
            setStatus('status', (data && data.message) || "Error adding blog post.", true);
            return;
        }
        setStatus('status', data.message || "Blog Post Successful...");
        window.location.pathname = "/";
    }).catch(() => {
        setStatus('status', "Network error.", true);
    });

}

/* AJAX Delete Blog Post */
function deletePost(){

    console.log("Delete Post");

    let delId = document.querySelector('#delPostId').value;
    fetch("/posts/"+delId+"/delete", {method:"POST"})
        .then(async res => {
            const data = await res.json().catch(()=>({}));
            if (!res.ok || !data.ok) {
                setStatus('delStatus', (data && data.message) || "Error deleting post.", true);
                return;
            }
            setStatus('delStatus', data.message || "Delete Successful...");
            loadPosts();
        }).catch(() => {
            setStatus('delStatus', "Network error.", true);
        });

}

function sendMfaCode(){
    const username = document.querySelector('#uname') ? document.querySelector('#uname').value : '';
    if (!username) {
        setStatus('status', "Please enter your username before obtaining the verification code.", true);
        return;
    }

    fetch("/users/mfa/send", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({username})
    }).then(async res => {
        const data = await res.json().catch(()=>({}));
        if (!res.ok || !data.ok) {
            setStatus('status', (data && data.message) || "Verification code delivery failed.", true);
            return;
        }
        setStatus('status', data.message || "The verification code has been sent.", false);
    }).catch(() => {
        setStatus('status', "Network error.", true);
    });
}

/* AJAX Login */
function login(){

    console.log("Login");

    var credentials = {
                        username: document.querySelector('#uname').value,
                        password: document.querySelector('#pword').value,
                        code: document.querySelector('#mfacode').value
                    };
    if (!credentials.username || !credentials.password || !credentials.code) {
        setStatus('status', "Please enter your username, password, and verification code.", true);
        return;
    }
    fetch("/users/login", {
        method:"POST",
        headers: {"Content-type":"application/json"},
        body: JSON.stringify(credentials)
    }).then(async res => {
        const data = await res.json().catch(()=>({}));
        if (!res.ok || !data.ok) {
            setStatus('status', (data && data.message) || "Login Failed.", true);
            return;
        }

        setStatus('status', data.message || "Login Successful...");

        let path = (new URLSearchParams(window.location.search)).get("target");
        if(path === null){
            path = '/';
        }

        window.location.pathname = path;
    }).catch(() => {
        setStatus('status',"Network error.", true);
    });

}

/* AJAX Signup */
function signup(){

    console.log("Sign Up");

    var credentials = {
                        username: document.querySelector('#newuname').value,
                        password: document.querySelector('#newpword').value,
                        given_name: document.querySelector('#newgname').value,
                        family_name: document.querySelector('#newfname').value,
                        email: document.querySelector('#newemail').value
                    };
    if (!credentials.username || !credentials.password || !credentials.given_name || !credentials.family_name) {
        setStatus('status', "Please fill in all required fields.", true);
        return;
    }
    fetch("/users/signup", {
        method:"POST",
        headers: {"Content-type":"application/json"},
        body: JSON.stringify(credentials)
    }).then(async res => {
        const data = await res.json().catch(()=>({}));
        if (!res.ok || !data.ok) {
            setStatus('status', (data && data.message) || "Signup Failed.", true);
            return;
        }
        setStatus('status', data.message || "Sign up Successful... Please Log In to confirm");
    }).catch(() => {
        setStatus('status', "Network error.", true);
    });

}

/* AJAX Logout */
function logout(){

    console.log("Logout");

    fetch("/users/logout", {method:"POST"})
        .then(res => {
            if (res.ok) {
                window.location.pathname = "/";
            }
        });

}

/* Only show profile button if logged in */
window.addEventListener("load", function () {

    const role = getCookie("role");
    if (role === "admin" || role === "user") {
        let btn = document.getElementById("profileBtn");
        if (btn) btn.style.display = "block";
    }
    updateNavByRole(role);
});

/* Temperature check */
document.addEventListener("click", async function (e) {
    if (e.target && e.target.id === "submitTempBtn") {

        const temp = parseFloat(document.getElementById("tempInput").value);

        if (isNaN(temp)) {
            alert("Please enter a valid number.");
            return;
        }

        await fetch("/users/update_temp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ temperature: temp })
        }).catch(err => console.error("Temp update error", err));

        if (temp > 37.3) {
            alert("Congratulations! You may have contracted Covid-19!");

            const allow = document.querySelector('#allowBroadcast').checked;
            window.location.href = "/index.html";
            if (allow) {
                fetch("/system/infection_broadcast", {
                    method: "POST"
                })
                .then(res => res.json())
                .then(d => console.log("Broadcast posted:", d))
                .catch(err => console.error("Broadcast error:", err));
            } else {
                console.log("User chose NOT to broadcast.");
            }
        } else {
            alert("Your body tempurature is normal.");
        }
    }
});

/* Load profile information into input fields */
function loadProfile() {
    const role = ensureLoggedIn();
    updateNavByRole(role);

    fetch("/users/profile")
        .then(res => {
            if (res.status === 401) {
                window.location = "/login.html";
            }
            return res.json();
        })
        .then(data => {
            if (!data || !data.ok) {
                setStatus("status", (data && data.message) || "无法获取资料。", true);
                return;
            }

            document.getElementById("givenName").value = data.given_name || "";
            document.getElementById("familyName").value = data.family_name || "";
            document.getElementById("email").value = data.email || "";

            if (data.temperature !== undefined) {
                document.getElementById("tempInput").value = data.temperature;
            }
        });
}

function saveProfile() {

    const payload = {
        given_name: document.getElementById("givenName").value,
        family_name: document.getElementById("familyName").value,
        email: document.getElementById("email").value
    };

    fetch("/users/update_profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    }).then(res => {
        return res.json().catch(()=>({ok:false, message:"Update failed."}));
    }).then(data => {
        setStatus("status", data.message || (data.ok ? "Profile updated successfully." : "Update failed."), !data.ok);
    });
}

function submitTemperature() {

    const temp = parseFloat(document.getElementById("tempInput").value);

    fetch("/users/update_temp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ temperature: temp })
    }).then(() => {

        if (temp > 37.3) {
            alert("Your temperature is above 37.3°C. A system alert will be posted.");

            fetch("/system/infection_broadcast", {
                method: "POST"
            });
        } else {
            alert("Your body temperature is normal.");
        }

    });
}

function ensureLoggedIn(){
    const role = getCookie("role");
    if (role !== "admin" && role !== "user") {
        const target = encodeURIComponent(window.location.pathname);
        window.location = `/login.html?target=${target}`;
    }
    return role;
}

function broadcastInfected(){
    fetch("/system/infection_broadcast", {method:"POST"})
        .then(res => res.json().catch(()=>({ok:false,message:"Broadcast failed."})))
        .then(data => {
            setStatus("delStatus", data.message || "Broadcast posted.", !data.ok);
            if (data.ok) {
                loadPosts();
            }
        })
        .catch(() => setStatus("delStatus", "Network error.", true));
}

function loadEditor(){
    const role = ensureLoggedIn();
    updateNavByRole(role);
}

async function likePost(postId) {
    try {
        const res = await fetch(`/posts/${postId}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        if (data.ok) {
            const span = document.getElementById(`like-count-${postId}`);
            if (span) span.innerText = data.likes;
        } else {
            alert("Failed to like post.");
        }
    } catch (err) {
        console.error("Like error:", err);
    }
}

async function dislikePost(postId) {
    try {
        const res = await fetch(`/posts/${postId}/dislike`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        if (data.ok) {
            const span = document.getElementById(`dislike-count-${postId}`);
            if (span) span.innerText = data.dislikes;
        } else {
            alert("Failed to dislike post.");
        }
    } catch (err) {
        console.error("Dislike error:", err);
    }
}