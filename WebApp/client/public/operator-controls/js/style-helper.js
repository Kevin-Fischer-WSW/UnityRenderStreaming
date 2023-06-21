export function SetActive(element, active){
    if(active){
        element.classList.add("active");
    }else{
        element.classList.remove("active");
    }
}
