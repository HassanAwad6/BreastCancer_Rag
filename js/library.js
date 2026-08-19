const STORAGE_QUESTION =
    "bcai_current_question";


const sourceSearch =
    document.getElementById(
        "sourceSearch"
    );


const sourceCards =
    Array.from(
        document.querySelectorAll(
            ".source-card"
        )
    );


const emptySourceSearch =
    document.getElementById(
        "emptySourceSearch"
    );


const modal =
    document.getElementById(
        "detailsModal"
    );


const modalClose =
    document.getElementById(
        "modalClose"
    );


const modalTitle =
    document.getElementById(
        "modalTitle"
    );


const modalText =
    document.getElementById(
        "modalText"
    );


// =========================================================
// SOURCE DETAILS
// =========================================================

const sourceDetails = {

    NG101: {

        title:
            "NICE NG101",

        text:
            "Early and locally advanced breast cancer: "
            +
            "diagnosis and management. "
            +
            "This guideline is built into the system "
            +
            "knowledge base and is available automatically "
            +
            "to the clinical RAG assistant."
    },


    CG81: {

        title:
            "NICE CG81",

        text:
            "Advanced breast cancer: diagnosis and treatment. "
            +
            "This guideline is built into the system "
            +
            "knowledge base and is available automatically "
            +
            "to the clinical RAG assistant."
    }
};


// =========================================================
// SEARCH SOURCES
// =========================================================

sourceSearch.addEventListener(
    "input",
    () => {

        const value =
            sourceSearch
                .value
                .trim()
                .toLowerCase();


        let visible = 0;


        sourceCards.forEach(
            (card) => {

                const matches =
                    (
                        card.dataset.search
                        ||
                        ""
                    )
                    .includes(
                        value
                    );


                card.style.display =
                    matches
                        ? "flex"
                        : "none";


                if (matches) {

                    visible += 1;
                }
            }
        );


        emptySourceSearch.style.display =
            visible === 0
                ? "block"
                : "none";
    }
);


// =========================================================
// ASK ABOUT SOURCE
// =========================================================

document
    .querySelectorAll(
        ".ask-source-button"
    )
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const source =
                        button.dataset.source;


                    let question;


                    if (
                        source === "CG81"
                    ) {

                        question =
                            "What imaging assessment is recommended for advanced breast cancer in NICE CG81?";

                    }

                    else {

                        question =
                            "What treatment is recommended for HER2-positive breast cancer in NICE NG101?";
                    }


                    localStorage.setItem(
                        STORAGE_QUESTION,
                        question
                    );


                    window.location.href =
                        "chat.html";
                }
            );
        }
    );


// =========================================================
// SOURCE DETAILS MODAL
// =========================================================

document
    .querySelectorAll(
        ".details-button"
    )
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const details =
                        sourceDetails[
                            button.dataset.source
                        ];


                    modalTitle.textContent =
                        details.title;


                    modalText.textContent =
                        details.text;


                    modal.hidden =
                        false;
                }
            );
        }
    );


// =========================================================
// CLOSE MODAL
// =========================================================

function closeModal() {

    modal.hidden =
        true;
}


modalClose.addEventListener(
    "click",
    closeModal
);


modal.addEventListener(
    "click",
    (event) => {

        if (
            event.target === modal
        ) {

            closeModal();
        }
    }
);


document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
            &&
            !modal.hidden
        ) {

            closeModal();
        }
    }
);