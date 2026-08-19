// =========================================================
// STORAGE
// =========================================================

const STORAGE_QUESTION = "bcai_current_question";
const STORAGE_HISTORY = "bcai_citation_history";


// =========================================================
// ELEMENTS
// =========================================================

const conversation =
    document.getElementById("conversation");

const chatInput =
    document.getElementById("chatInput");

const sendButton =
    document.getElementById("chatSendButton");

const evidenceDrawer =
    document.getElementById("evidenceDrawer");

const drawerClose =
    document.getElementById("drawerClose");

const copyCitationButton =
    document.getElementById("copyCitationButton");


// Hide Open Full PDF for now.
// The actual PDF files are not being served by FastAPI.
const openFullPdfButton =
    document.querySelector(".drawer-primary");

if (openFullPdfButton) {
    openFullPdfButton.hidden = true;
}


// =========================================================
// STATE
// =========================================================

let latestQuestion = "";

let activeCitation = null;

let responseInProgress = false;


// =========================================================
// CALL FASTAPI RAG
// =========================================================

async function askRAG(question) {

    const response = await fetch(
        "/api/ask",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: question
            })
        }
    );


    if (!response.ok) {

        throw new Error(
            `API error: ${response.status}`
        );
    }


    const data =
        await response.json();


    if (
        !data
        ||
        typeof data.answer !== "string"
    ) {

        throw new Error(
            "Invalid API response."
        );
    }


    return data;
}


// =========================================================
// CREATE USER MESSAGE
// =========================================================

function createUserMessage(question) {

    latestQuestion = question;


    const group =
        document.createElement("div");

    group.className =
        "message-group";


    const message =
        document.createElement("div");

    message.className =
        "user-message";

    message.textContent =
        question;


    group.appendChild(
        message
    );


    conversation.appendChild(
        group
    );


    scrollToBottom();
}


// =========================================================
// CREATE RAG PROCESS ANIMATION
// =========================================================

function createProcess() {

    const group =
        document.createElement("div");

    group.className =
        "message-group";


    group.innerHTML = `
        <div class="ai-process">

            <div class="process-orb"></div>

            <div class="process-copy">

                <strong class="process-title">
                    Searching clinical guidelines...
                </strong>

                <span class="process-subtitle">
                    Retrieving relevant NICE evidence
                </span>

            </div>

        </div>
    `;


    conversation.appendChild(
        group
    );


    scrollToBottom();


    return group;
}


// =========================================================
// UPDATE PROCESS TEXT
// =========================================================

function updateProcess(
    group,
    title,
    subtitle
) {

    if (!group || !group.isConnected) {
        return;
    }


    const titleElement =
        group.querySelector(
            ".process-title"
        );

    const subtitleElement =
        group.querySelector(
            ".process-subtitle"
        );

    const processBox =
        group.querySelector(
            ".ai-process"
        );


    if (titleElement) {
        titleElement.textContent = title;
    }


    if (subtitleElement) {
        subtitleElement.textContent = subtitle;
    }


    if (processBox) {

        processBox.animate(
            [
                {
                    opacity: 0.68,
                    transform:
                        "translateY(2px)"
                },

                {
                    opacity: 1,
                    transform:
                        "translateY(0)"
                }
            ],

            {
                duration: 220,
                easing: "ease"
            }
        );
    }
}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================================================
// FORMAT LLM ANSWER
// =========================================================

function formatAnswer(text) {

    if (!text) {
        return "";
    }


    let safeText =
        escapeHTML(text);


    // Markdown bold
    safeText = safeText.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );


    const lines =
        safeText.split(/\r?\n/);


    let html = "";

    let insideList = false;


    function closeList() {

        if (insideList) {

            html += "</ul>";

            insideList = false;
        }
    }


    for (const rawLine of lines) {

        const line =
            rawLine.trim();


        // Empty line
        if (!line) {

            closeList();

            continue;
        }


        // Markdown headings
        if (line.startsWith("### ")) {

            closeList();

            html +=
                `<h3>${line.substring(4)}</h3>`;

            continue;
        }


        if (line.startsWith("## ")) {

            closeList();

            html +=
                `<h3>${line.substring(3)}</h3>`;

            continue;
        }


        // Detect our known RAG headings
        const plainLine =
            line.replace(
                /<\/?strong>/g,
                ""
            );


        if (
            /^(Recommendations?|Supporting Evidence|Citation|Confidence and Safety|Insufficient Context):?$/i
                .test(plainLine)
        ) {

            closeList();

            html +=
                `<h3>${line.replace(/:$/, "")}</h3>`;

            continue;
        }


        // Bullet points
        if (
            line.startsWith("- ")
            ||
            line.startsWith("* ")
        ) {

            if (!insideList) {

                html += "<ul>";

                insideList = true;
            }


            html +=
                `<li>${line.substring(2)}</li>`;

            continue;
        }


        // Normal paragraph
        closeList();

        html +=
            `<p>${line}</p>`;
    }


    closeList();


    return html;
}


// =========================================================
// REMOVE DUPLICATE SOURCES
// =========================================================

function uniqueSources(sources) {

    if (!Array.isArray(sources)) {
        return [];
    }


    const seen =
        new Set();


    return sources.filter(
        (source) => {

            const key = [
                source.source,
                source.section,
                source.start_page,
                source.end_page
            ].join("|");


            if (seen.has(key)) {

                return false;
            }


            seen.add(key);

            return true;
        }
    );
}


// =========================================================
// GET SHORT SOURCE CODE
// =========================================================

function getSourceCode(sourceName) {

    const source =
        String(sourceName || "");


    if (
        source
            .toUpperCase()
            .includes("NG101")
    ) {

        return "NG101";
    }


    if (
        source
            .toUpperCase()
            .includes("CG81")
    ) {

        return "CG81";
    }


    return "NICE";
}


// =========================================================
// CREATE CITATION OBJECT
// =========================================================

function createCitationObject(source) {

    const shortSource =
        getSourceCode(
            source.source
        );


    const startPage =
        source.start_page;


    const endPage =
        source.end_page;


    let pages;

    let pageRange;


    if (startPage === endPage) {

        pages =
            `Page ${startPage}`;

        pageRange =
            `${startPage}`;

    }

    else {

        pages =
            `Pages ${startPage}–${endPage}`;

        pageRange =
            `${startPage}–${endPage}`;
    }


    return {

        source:
            source.source,

        shortSource:
            shortSource,

        section:
            `Section ${source.section}`,

        sectionNumber:
            String(
                source.section ?? ""
            ),

        pages:
            pages,

        pageRange:
            pageRange,

        description:
            source.section_name
            ||
            "Retrieved NICE guideline evidence.",

        filename:
            `${shortSource}.pdf`,

        firstPage:
            startPage,

        pageCount:
            pages,

        previewTitle:
            `${source.section ?? ""} ${source.section_name ?? ""}`.trim()
    };
}


// =========================================================
// CREATE REAL RAG ANSWER
// =========================================================

function createAnswer(data) {

    const sources =
        uniqueSources(
            data.sources || []
        );


    const group =
        document.createElement("div");

    group.className =
        "message-group";


    const article =
        document.createElement("article");

    article.className =
        "answer-card";


    // Header
    const header =
        document.createElement("div");

    header.className =
        "answer-header";


    const miniAI =
        document.createElement("div");

    miniAI.className =
        "mini-ai";


    const title =
        document.createElement("h2");

    title.textContent =
        data.status === "insufficient"
            ? "Guideline evidence result"
            : "Evidence-based answer";


    header.append(
        miniAI,
        title
    );


    article.appendChild(
        header
    );


    // Real LLM answer
    const answerBody =
        document.createElement("div");

    answerBody.className =
        "answer-body";


    answerBody.innerHTML =
        formatAnswer(
            data.answer
        );


    article.appendChild(
        answerBody
    );


    // =====================================================
    // REAL RETRIEVED SOURCES
    // =====================================================

    if (
        data.status === "success"
        &&
        sources.length > 0
    ) {

        const sourceArea =
            document.createElement("div");

        sourceArea.className =
            "source-area";


        const sourceLabel =
            document.createElement("div");

        sourceLabel.className =
            "source-label";

        sourceLabel.textContent =
            "Retrieved evidence";


        const sourceChips =
            document.createElement("div");

        sourceChips.className =
            "source-chips";


        sources.forEach(
            (source) => {

                const citation =
                    createCitationObject(
                        source
                    );


                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "source-chip evidence-trigger";


                button.textContent =
                    `${citation.shortSource} · ${citation.section} · ${citation.pages}`;


                button.addEventListener(
                    "click",
                    () => {

                        openEvidence(
                            citation
                        );
                    }
                );


                sourceChips.appendChild(
                    button
                );
            }
        );


        sourceArea.append(
            sourceLabel,
            sourceChips
        );


        article.appendChild(
            sourceArea
        );


        // View evidence button
        const viewEvidenceButton =
            document.createElement(
                "button"
            );


        viewEvidenceButton.type =
            "button";


        viewEvidenceButton.className =
            "view-evidence-button";


        viewEvidenceButton.textContent =
            "View supporting evidence →";


        viewEvidenceButton.addEventListener(
            "click",
            () => {

                openEvidence(
                    createCitationObject(
                        sources[0]
                    )
                );
            }
        );


        article.appendChild(
            viewEvidenceButton
        );


        // Save real citations
        saveCitationHistory(
            latestQuestion,
            sources
        );


        activeCitation =
            createCitationObject(
                sources[0]
            );
    }


    group.appendChild(
        article
    );


    conversation.appendChild(
        group
    );


    scrollToBottom();
}


// =========================================================
// ERROR ANSWER
// =========================================================

function createErrorAnswer() {

    const group =
        document.createElement("div");

    group.className =
        "message-group";


    const article =
        document.createElement("article");

    article.className =
        "answer-card";


    article.innerHTML = `
        <div class="answer-header">
            <div class="mini-ai"></div>
            <h2>Unable to generate answer</h2>
        </div>

        <p>
            The AI service is temporarily unavailable.
            Please try again.
        </p>
    `;


    group.appendChild(
        article
    );


    conversation.appendChild(
        group
    );


    scrollToBottom();
}


// =========================================================
// RUN REAL RAG
// =========================================================

async function runRag(question) {

    if (responseInProgress) {
        return;
    }


    responseInProgress = true;

    sendButton.disabled = true;


    const process =
        createProcess();


    const timers = [

        setTimeout(
            () => {

                updateProcess(
                    process,

                    "Retrieving relevant sections...",

                    "Combining semantic and keyword retrieval"
                );

            },
            500
        ),


        setTimeout(
            () => {

                updateProcess(
                    process,

                    "Reading supporting evidence...",

                    "Checking retrieved NICE guideline sections"
                );

            },
            1200
        ),


        setTimeout(
            () => {

                updateProcess(
                    process,

                    "Generating evidence-based answer...",

                    "Grounding the answer in retrieved evidence"
                );

            },
            2000
        )
    ];


    try {

        const data =
            await askRAG(
                question
            );


        timers.forEach(
            clearTimeout
        );


        process.remove();


        createAnswer(
            data
        );

    }

    catch (error) {

        console.error(
            "RAG request failed:",
            error
        );


        timers.forEach(
            clearTimeout
        );


        process.remove();


        createErrorAnswer();
    }


    responseInProgress = false;

    sendButton.disabled = false;

    chatInput.focus();
}


// =========================================================
// SEND MESSAGE
// =========================================================

function sendMessage() {

    const question =
        chatInput
            .value
            .trim();


    if (
        !question
        ||
        responseInProgress
    ) {

        if (!question) {

            chatInput.focus();
        }


        return;
    }


    createUserMessage(
        question
    );


    chatInput.value =
        "";


    chatInput.style.height =
        "auto";


    runRag(
        question
    );
}


// =========================================================
// SAVE REAL CITATION HISTORY
// =========================================================

function saveCitationHistory(
    question,
    sources
) {

    if (
        !question
        ||
        !Array.isArray(sources)
        ||
        sources.length === 0
    ) {

        return;
    }


    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_HISTORY
                )
                ||
                "[]"
            );


        if (!Array.isArray(history)) {

            history = [];
        }

    }

    catch {

        history = [];
    }


    const unique =
        uniqueSources(
            sources
        );


    unique.forEach(
        (source) => {

            const citation =
                createCitationObject(
                    source
                );


            history.unshift({

                id:
                    `${Date.now()}-${Math.random()}`,

                question:
                    question,

                source:
                    citation.source,

                section:
                    citation.section,

                pages:
                    citation.pages,

                description:
                    citation.description,

                date:
                    new Date()
                        .toLocaleString()
            });
        }
    );


    localStorage.setItem(

        STORAGE_HISTORY,

        JSON.stringify(
            history.slice(
                0,
                50
            )
        )
    );
}


// =========================================================
// OPEN EVIDENCE DRAWER
// =========================================================

function openEvidence(citation) {

    if (
        !citation
        ||
        !evidenceDrawer
    ) {

        return;
    }


    activeCitation =
        citation;


    document
        .getElementById(
            "drawerSource"
        )
        .textContent =
        citation.shortSource;


    document
        .getElementById(
            "drawerSection"
        )
        .textContent =
        citation.sectionNumber;


    document
        .getElementById(
            "drawerPages"
        )
        .textContent =
        citation.pageRange;


    document
        .getElementById(
            "drawerDescription"
        )
        .textContent =
        citation.description;


    document
        .getElementById(
            "drawerFilename"
        )
        .textContent =
        citation.filename;


    document
        .getElementById(
            "drawerPageLabel"
        )
        .textContent =
        citation.pages;


    document
        .getElementById(
            "drawerPageCount"
        )
        .textContent =
        citation.pages;


    document
        .getElementById(
            "drawerPreviewTitle"
        )
        .textContent =
        citation.previewTitle;


    const highlightText =
        document.querySelector(
            ".pdf-highlight p"
        );


    if (highlightText) {

        highlightText.textContent =
            "This guideline section was retrieved as supporting evidence for the answer.";
    }


    evidenceDrawer
        .classList
        .remove(
            "closed"
        );
}


// =========================================================
// CLOSE EVIDENCE
// =========================================================

function closeEvidence() {

    if (evidenceDrawer) {

        evidenceDrawer
            .classList
            .add(
                "closed"
            );
    }
}


// =========================================================
// SCROLL
// =========================================================

function scrollToBottom() {

    requestAnimationFrame(
        () => {

            conversation.scrollTop =
                conversation.scrollHeight;
        }
    );
}


// =========================================================
// SEND BUTTON
// =========================================================

sendButton.addEventListener(
    "click",
    sendMessage
);


// =========================================================
// ENTER
// =========================================================

chatInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
            &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


// =========================================================
// AUTO RESIZE TEXTAREA
// =========================================================

chatInput.addEventListener(
    "input",
    () => {

        chatInput.style.height =
            "auto";


        chatInput.style.height =
            `${Math.min(
                chatInput.scrollHeight,
                120
            )}px`;
    }
);


// =========================================================
// CLOSE DRAWER
// =========================================================

if (drawerClose) {

    drawerClose.addEventListener(
        "click",
        closeEvidence
    );
}


// =========================================================
// COPY REAL CITATION
// =========================================================

if (copyCitationButton) {

    copyCitationButton.addEventListener(
        "click",
        async () => {

            if (!activeCitation) {
                return;
            }


            const text =
                `${activeCitation.source} - `
                +
                `${activeCitation.section}, `
                +
                `${activeCitation.pages}`;


            try {

                await navigator
                    .clipboard
                    .writeText(
                        text
                    );


                copyCitationButton.textContent =
                    "Copied ✓";


                setTimeout(
                    () => {

                        copyCitationButton.textContent =
                            "Copy Citation";

                    },
                    1300
                );

            }

            catch {

                copyCitationButton.textContent =
                    "Copy unavailable";


                setTimeout(
                    () => {

                        copyCitationButton.textContent =
                            "Copy Citation";

                    },
                    1300
                );
            }
        }
    );
}


// =========================================================
// QUESTION FROM HOME PAGE
// =========================================================

const firstQuestion =
    localStorage.getItem(
        STORAGE_QUESTION
    );


if (firstQuestion) {

    // Important:
    // remove it so refreshing the page
    // does not send the same question again.
    localStorage.removeItem(
        STORAGE_QUESTION
    );


    createUserMessage(
        firstQuestion
    );


    runRag(
        firstQuestion
    );
}


// =========================================================
// PAGE TRANSITION
// =========================================================

requestAnimationFrame(
    () => {

        requestAnimationFrame(
            () => {

                document.body
                    .classList
                    .remove(
                        "chat-preload"
                    );
            }
        );
    }
);