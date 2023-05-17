let counter = 0
export function createUploadProgressTracker(parent, request, name) {
    let progressFieldUpload = createProgressTracker(parent);
    let progressUpload = document.querySelector(`#${progressFieldUpload.id} .progressupload`);
    let progressTextUpload = document.querySelector(`#${progressFieldUpload.id} .progresstextupload`);
    let remainingTextUpload = document.querySelector(`#${progressFieldUpload.id} .remainingtextupload`);
    // todo Create the elements that will be added to the dom.
    let start = new Date().getTime();

    request.upload.addEventListener("progress", function (e) {

        progressFieldUpload.classList.remove("d-none"); // display the upload progress

        if (e.lengthComputable) {
            progressUpload.max = e.total
            progressUpload.value = e.loaded

            let percent = (e.loaded / e.total) * 100;
            percent = Math.floor(percent);
            progressTextUpload.innerHTML = "Uploading: " + name + ". Status: " + percent + "%.";

            let end = new Date().getTime();
            let duration = (end - start) / 1000;
            let bps = e.loaded / duration;
            let kbps = Math.floor(bps / 1024);

            let time = (e.total - e.loaded) / bps;
            let min = Math.floor(time / 60)
            let sec = Math.floor(time % 60)
            remainingTextUpload.innerHTML = "Speed: " + kbps + " KB/s. Remaining time: " + min + " minute(s) " + sec + " second(s).";
        }
    })

    request.upload.addEventListener("loadend", function (e) {
        setTimeout(() => {
            progressFieldUpload.remove(); // remove tracker
        }, 800)
    })

    request.upload.addEventListener("error", function (e) {
        progressTextUpload.innerHTML = "Upload Failed.";
        request.abort();
    })

    request.upload.addEventListener("load", function (e) {
        progressUpload.value = e.loaded;
        remainingTextUpload.innerHTML = "Done!";
    })

}

export function createProgressTracker(parent) {
    counter += 1
    let progressFieldUpload = document.createElement("field");
    progressFieldUpload.classList.add("m-2");
    progressFieldUpload.classList.add("w-100");
    progressFieldUpload.classList.add("d-none");
    progressFieldUpload.id = "progress-upload-" + counter
    progressFieldUpload.innerHTML =
        `<progress class="progressupload" value="0"></progress>
    <strong  class="progresstextupload text-white"></strong>
    <strong  class="remainingtextupload text-white"></strong>`;
    parent.appendChild(progressFieldUpload);
    return progressFieldUpload;
}