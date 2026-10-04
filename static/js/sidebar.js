function showTab(tab){

    document
    .querySelectorAll(".tabContent")
    .forEach(x=>{

        x.style.display="none";

    });

    document
    .querySelectorAll(".tab")
    .forEach(x=>{

        x.classList.remove("active");

    });

    document
    .getElementById(tab)
    .style.display="block";

    event.target.classList.add("active");

}