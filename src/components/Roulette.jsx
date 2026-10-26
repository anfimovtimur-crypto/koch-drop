import { useEffect, useRef, useState } from "react"


function Roulette({ items, onDrop, caseName }) {


  const trackRef = useRef(null)

  const [cards, setCards] = useState([])



  function randomItem(){


    const total = items.reduce(
      (sum, item) => sum + Number(item.chance || 1),
      0
    )


    let roll = Math.random() * total


    for (const item of items) {


      roll -= Number(item.chance || 1)


      if (roll <= 0) {

        return item

      }

    }


    return items[0]

  }




  useEffect(() => {


    const winIndex = 40


    const generated = []


    for(let i = 0; i < 80; i++){

      generated.push(randomItem())

    }



    setCards(generated)



    setTimeout(()=>{


      if(trackRef.current){


        const cardWidth = 180


        const move =
        winIndex * cardWidth - 400



        trackRef.current.style.transition =
        "transform 12s cubic-bezier(.05,.8,.15,1)"


        trackRef.current.style.transform =
        `translateX(-${move}px)`


      }


    },300)



    setTimeout(()=>{


      const result = generated[winIndex]


      console.log("ВЫПАЛО:", result.name)


      onDrop(result)


    },12500)



  },[])






return (

  <div className="roulette-wrapper">

    <h2 className="roulette-title">
      {caseName}
    </h2>


    <div className="pointer">
      ▼
    </div>


    <div className="roulette-window">


        <div
        className="roulette-track"
        ref={trackRef}
        >


        {
          cards.map((item,index)=>(

            <div
            key={index}
            className={`roulette-card ${item.rarity}`}
            >

              <div>
                {item.name}
              </div>


              <small>
                {item.price}₽
              </small>


            </div>

          ))
        }


        </div>


      </div>


    </div>

  )

}


export default Roulette