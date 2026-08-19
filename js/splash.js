const splashPage = document.getElementById('splashPage');

setTimeout(() => {
  splashPage.classList.add('fade-out');
}, 1700);

setTimeout(() => {
  window.location.href = 'home.html';
}, 2200);
