const STORAGE_HISTORY =
    "bcai_citation_history";


const STORAGE_QUESTION =
    "bcai_current_question";


const historyList =
    document.getElementById(
        "historyList"
    );


const historyEmpty =
    document.getElementById(
        "historyEmpty"
    );


const historyCount =
    document.getElementById(
        "historyCount"
    );


const historySearch =
    document.getElementById(
        "historySearch"
    );


const clearHistoryButton =
    document.getElementById(
        "clearHistoryButton"
    );


// =========================================================
// GET HISTORY
// =========================================================

function getHistory() {

    try {

        const value =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_HISTORY
                )
                ||
                "[]"
            );


        return Array.isArray(value)
            ? value
            : [];

    }

    catch {

        return [];
    }
}


// =========================================================
// RENDER HISTORY
// =========================================================

function renderHistory(
    search = ""
) {

    const needle =
        search
            .trim()
            .toLowerCase();


    const history =
        getHistory()
            .filter(
                (item) => {

                    const haystack = `
                        ${item.question || ""}
                        ${item.source || ""}
                        ${item.section || ""}
                        ${item.pages || ""}
                        ${item.description || ""}
                    `.toLowerCase();


                    return haystack.includes(
                        needle
                    );
                }
            );


    historyList.innerHTML =
        "";


    historyCount.textContent =
        `${history.length} ${
            history.length === 1
                ? "citation"
                : "citations"
        }`;


    historyEmpty.hidden =
        history.length !== 0;


    historyList.style.display =
        history.length
            ? "flex"
            : "none";


    history.forEach(
        (item) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "history-card";


            // ---------------------------------------------
            // LEFT SIDE
            // ---------------------------------------------

            const left =
                document.createElement(
                    "div"
                );


            const time =
                document.createElement(
                    "div"
                );


            time.className =
                "history-time";


            time.textContent =
                item.date
                ||
                "";


            const question =
                document.createElement(
                    "div"
                );


            question.className =
                "history-question";


            question.textContent =
                item.question
                ||
                "";


            const chips =
                document.createElement(
                    "div"
                );


            chips.className =
                "history-chips";


            [
                item.source,
                item.section,
                item.pages
            ]
            .forEach(
                (label) => {

                    if (!label) {
                        return;
                    }


                    const chip =
                        document.createElement(
                            "span"
                        );


                    chip.className =
                        "history-chip";


                    chip.textContent =
                        label;


                    chips.appendChild(
                        chip
                    );
                }
            );


            left.append(
                time,
                question,
                chips
            );


            // ---------------------------------------------
            // ACTIONS
            // ---------------------------------------------

            const actions =
                document.createElement(
                    "div"
                );


            actions.className =
                "history-actions";


            const copy =
                document.createElement(
                    "button"
                );


            copy.className =
                "copy-history";


            copy.type =
                "button";


            copy.textContent =
                "Copy";


            const askAgain =
                document.createElement(
                    "button"
                );


            askAgain.className =
                "ask-again";


            askAgain.type =
                "button";


            askAgain.textContent =
                "Ask again";


            actions.append(
                copy,
                askAgain
            );


            // ---------------------------------------------
            // COPY CITATION
            // ---------------------------------------------

            copy.addEventListener(
                "click",
                async () => {

                    const citation =
                        `${item.source} - `
                        +
                        `${item.section}, `
                        +
                        `${item.pages}`;


                    try {

                        await navigator
                            .clipboard
                            .writeText(
                                citation
                            );


                        copy.textContent =
                            "Copied ✓";


                        setTimeout(
                            () => {

                                copy.textContent =
                                    "Copy";

                            },
                            1200
                        );

                    }

                    catch {

                        copy.textContent =
                            "Unavailable";


                        setTimeout(
                            () => {

                                copy.textContent =
                                    "Copy";

                            },
                            1200
                        );
                    }
                }
            );


            // ---------------------------------------------
            // ASK AGAIN
            // ---------------------------------------------

            askAgain.addEventListener(
                "click",
                () => {

                    localStorage.setItem(
                        STORAGE_QUESTION,
                        item.question || ""
                    );


                    window.location.href =
                        "chat.html";
                }
            );


            card.append(
                left,
                actions
            );


            historyList.appendChild(
                card
            );
        }
    );
}


// =========================================================
// SEARCH
// =========================================================

historySearch.addEventListener(
    "input",
    () => {

        renderHistory(
            historySearch.value
        );
    }
);


// =========================================================
// CLEAR HISTORY
// =========================================================

clearHistoryButton.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            STORAGE_HISTORY
        );


        renderHistory(
            historySearch.value
        );
    }
);


// =========================================================
// INITIAL RENDER
// =========================================================

renderHistory();