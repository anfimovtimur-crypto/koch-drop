import "./Banner.css"

function Banner(){

return (

<div className="banner">

    <div className="banner-text">

        <h1>
            Новый Skull Case
        </h1>

        <p>
            Редкие скины уже ждут тебя
        </p>

        <button>
            Открыть кейсы
        </button>

    </div>


    <img 
      src="/banner.png"
      className="banner-image"
    />

</div>

)

}


export default Banner