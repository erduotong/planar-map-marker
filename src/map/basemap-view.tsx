import { useEffect, useState } from "react"
import type { Asset } from "@/domain/models"
import { SimpleMap } from "@/map/simple-map"

export function BasemapView({ asset }: { asset: Asset }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    const next = URL.createObjectURL(asset.blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [asset.blob])

  if (!url) return <div className="h-full bg-muted/50" />

  return (
    <SimpleMap
      imageUrl={url}
      size={asset.size}
      className="relative h-full w-full overflow-hidden"
    />
  )
}
