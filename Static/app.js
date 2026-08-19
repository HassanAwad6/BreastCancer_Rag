// ==================================================
// ELEMENTS
// ==================================================

const form =
    document.getElementById("questionForm");

const input =
    document.getElementById("questionInput");

const sendButton =
    document.getElementById("sendButton");

const messages =
    document.getElementById("messages");

const welcome =
    document.getElementById("welcome");

const suggestions =
    document.querySelectorAll(".suggestion");


// ==================================================
// AUTO RESIZE TEXTAREA
// ==================================================

function resizeInput() {

    input.style.height = "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            160
        ) + "px";
}


input.addEventListener(
    "input",
    resizeInput
);


// ==================================================
// ENTER TO SEND
// SHIFT + ENTER = NEW LINE
// ==================================================

input.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            form.requestSubmit();
        }
    }
);


// ==================================================
// ADD USER MESSAGE
// ==================================================

function addUserMessage(text) {

    const message =
        document.createElement("div");

    message.className =
        "message user";


    const bubble =
        document.createElement("div");

    bubble.className =
        "user-bubble";

    // textContent prevents HTML injection.
    bubble.textContent =
        text;


    message.appendChild(
        bubble
    );

    messages.appendChild(
        message
    );


    scrollToBottom();
}


// ==================================================
// ADD ASSISTANT MESSAGE
// ==================================================

function addAssistantMessage(text) {

    const message =
        document.createElement("div");

    message.className =
        "message";


    const content =
        document.createElement("div");

    content.className =
        "assistant-message";


    const avatar =
        document.createElement("div");

    avatar.className =
        "assistant-avatar";

    avatar.textContent =
        "B";


    const answer =
        document.createElement("div");

    answer.className =
        "assistant-content";

    answer.textContent =
        text;


    content.appendChild(
        avatar
    );

    content.appendChild(
        answer
    );

    message.appendChild(
        content
    );

    messages.appendChild(
        message
    );


    scrollToBottom();
}


// ==================================================
// LOADING MESSAGE
// ==================================================

function addLoadingMessage() {

    const message =
        document.createElement("div");

    message.className =
        "message";

    message.id =
        "loadingMessage";


    const content =
        document.createElement("div");

    content.className =
        "assistant-message";


    const avatar =
        document.createElement("div");

    avatar.className =
        "assistant-avatar";

    avatar.textContent =
        "B";


    const loading =
        document.createElement("div");

    loading.className =
        "loading";


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        loading.appendChild(
            document.createElement("span")
        );
    }


    content.appendChild(
        avatar
    );

    content.appendChild(
        loading
    );

    message.appendChild(
        content
    );

    messages.appendChild(
        message
    );


    scrollToBottom();
}


// ==================================================
// REMOVE LOADING
// ==================================================

function removeLoadingMessage() {

    const loading =
        document.getElementById(
            "loadingMessage"
        );

    if (loading) {
        loading.remove();
    }
}


// ==================================================
// SCROLL
// ==================================================

function scrollToBottom() {

    window.scrollTo({
        top:
            document.body.scrollHeight,

        behavior:
            "smooth"
    });
}


// ==================================================
// SEND QUESTION TO FASTAPI
// ==================================================

async function askQuestion(question) {

    try {

        const response =
            await fetch(
                "/api/ask",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            question:
                                question
                        })
                }
            );


        if (!response.ok) {

            let errorMessage =
                "Something went wrong.";

            try {

                const errorData =
                    await response.json();

                if (errorData.detail) {

                    errorMessage =
                        errorData.detail;
                }

            } catch {
                // Keep generic error.
            }


            throw new Error(
                errorMessage
            );
        }


        const data =
            await response.json();


        return data.answer;


    } catch (error) {

        console.error(
            error
        );


        return (
            "The system could not complete your request. " +
            "Please try again."
        );
    }
}


// ==================================================
// FORM SUBMIT
// ==================================================

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const question =
            input.value.trim();


        if (!question) {
            return;
        }


        // Hide welcome state
        welcome.style.display =
            "none";


        // Show user's question
        addUserMessage(
            question
        );


        // Clear input
        input.value =
            "";

        resizeInput();


        // Disable while processing
        sendButton.disabled =
            true;

        input.disabled =
            true;


        // Loading animation
        addLoadingMessage();


        // Call backend
        const answer =
            await askQuestion(
                question
            );


        removeLoadingMessage();


        // Display answer
        addAssistantMessage(
            answer
        );


        // Re-enable input
        sendButton.disabled =
            false;

        input.disabled =
            false;

        input.focus();
    }
);


// ==================================================
// SUGGESTED QUESTIONS
// ==================================================

suggestions.forEach(

    function (button) {

        button.addEventListener(
            "click",
            function () {

                input.value =
                    button.dataset.question;

                resizeInput();

                form.requestSubmit();
            }
        );
    }
);