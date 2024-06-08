
window.addEventListener('DOMContentLoaded', async function(){
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const iframeContainer = entry.target;
            const iframeSrc = iframeContainer.dataset.src;
            const iframe = document.createElement('iframe');
            iframe.src = iframeSrc;
            iframe.height = 500;
            iframe.width = 500;
            iframeContainer.replaceChild(iframe, iframeContainer.firstChild);
            observer.unobserve(iframeContainer); // Unobserve after loading
          }

        });
    })
    const iframeContainers = document.querySelectorAll('.iframe-container');
    iframeContainers.forEach(container => observer.observe(container));
})
