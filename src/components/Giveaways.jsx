import { useState } from "react"
import "./Giveaways.css"


function Giveaways(){

const [joined,setJoined] = useState([])


const giveaways = [
{
id:1,
name:"MAC-10 | Кислотные шестигранники",
price:15,
image:"/skins/glock.png",
players:0
},

{
id:2,
name:"FAMAS | Йети Камуфляж",
price:30,
image:"/skins/awp.png",
players:0
},

{
id:3,
name:"AK-47 | Оливковый Поликамуфляж",
price:25,
image:"/skins/m4.png",
players:0
}

]



function join(id){

if(joined.includes(id))
return


setJoined([
...joined,
id
])

}



return (

<div className="giveaways">


<h1>
 Розыгрыши
</h1>



<div className="giveaway-grid">


{
giveaways.map(item=>(


<div 
className="giveaway-card"
key={item.id}
>


<img src={item.image}/>



<h2>
{item.name}
</h2>



<p className="price">

 {item.price}₽

</p>



<p>

👥 Участников:

{
joined.filter(x => x === item.id).length
}

</p>



<p>

⏳ Осталось: 12:00:00

</p>




<button

disabled={joined.includes(item.id)}

onClick={()=>join(item.id)}

>

{

joined.includes(item.id)

?

" Ты участвуешь"

:

" Участвовать"

}


</button>



</div>


))


}


</div>



</div>

)

}


export default Giveaways