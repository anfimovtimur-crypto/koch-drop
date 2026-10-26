import { useState, useEffect } from "react"
import "./TopSlider.css"


function TopSlider(){

const slides = [

{
title:"Новые кейсы",
text:"Layrex • timeline947 • kiri4ch • bbos1k • жопка",
image:"/slider/cases.png"
},

{
title:"Режим Апгрейд",
text:"Улучши свои скины и попробуй получить больше",
image:"/slider/upgrader.png"
},

{
title:"Розыгрыши",
text:"Участвуй и забирай редкие призы",
image:"/slider/giveaways.png"
},

{
title:"Вывод в крипту",
text:"BTC • ETH • USDT • TON",
image:"/slider/crypto.png"
},

{
title:"Proton Drop",
text:"Новые функции уже скоро",
image:"/slider/proton.png"
}

]


const [index,setIndex] = useState(0)



useEffect(()=>{

const timer = setInterval(()=>{

setIndex((prev)=>
prev === slides.length-1 ? 0 : prev+1
)

},12000)


return ()=>clearInterval(timer)

},[])



return (

<div
  className="top-slider"
  style={{
    backgroundImage: `url(${slides[index].image})`
  }}
>


<button
className="slider-arrow"
onClick={()=>
setIndex(prev =>
prev === 0 ? slides.length - 1 : prev - 1
)
}
>
‹
</button>



<div className="slider-content">


<div>

<h1>
{slides[index].title}
</h1>


<p>
{slides[index].text}
</p>


<button className="slider-button">
Перейти
</button>


</div>






</div>



<button
className="slider-arrow"
onClick={()=>
setIndex(prev =>
prev === slides.length - 1 ? 0 : prev + 1
)
}
>
›
</button>



<div className="slider-dots">

{
slides.map((_,i)=>(

<span
key={i}
className={i===index ? "active":""}
onClick={()=>setIndex(i)}
>
</span>

))
}

</div>


</div>

)

}


export default TopSlider