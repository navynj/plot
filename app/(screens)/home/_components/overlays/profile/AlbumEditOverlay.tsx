'use client';

import ToggleButton from '@/components/button/ToggleButton';
import EmojiInput from '@/components/emoji/EmojiInput';
import OverlayForm from '@/components/overlay/OverlayForm';
import { albumsAtom } from '@/store/album';
import { emojiAtom } from '@/store/emoji';
import { profilesAtom } from '@/store/profile';
import { getLastLexo } from '@/util/lexo';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue } from 'jotai';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  icon: z.string().min(1, 'Please select icon.'),
  title: z.string().min(1, 'Please enter the title.'),
  profileId: z.string(),
});

type formSchemaType = z.infer<typeof formSchema>;

const AlbumEditOverlay = () => {
  const { data: albums, refetch: refetchAlbums } = useAtomValue(albumsAtom);
  const { data: profiles } = useAtomValue(profilesAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);

  const params = useSearchParams();
  const profileId = params.get('profileId') || '';
  const albumId = params.get('albumId') || '';
  const showOverlay = params.get('album-edit') || '';

  const [isActive, setIsActive] = useState(true);
  const [isProfileEmoji, setIsProfileEmoji] = useState(true);

  const form = useForm<formSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      icon: '',
      title: '',
      profileId,
    },
  });

  const submitHandler = async (values: formSchemaType) => {
    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/album';

    const body = JSON.stringify({
      ...values,
      rank: albumId ? undefined : getLastLexo(albums || []).toString(),
      isActive,
    });

    if (albumId) {
      await fetch(`${url}/${albumId}`, { method: 'PATCH', body });
    } else {
      await fetch(url, { method: 'POST', body });
    }

    refetchAlbums();
  };

  // 기본값 세팅
  useEffect(() => {
    if (showOverlay) {
      const profile = profiles?.find((profile) => profile.id === profileId);

      // 앨범 수정 로직 나중에 구체화
      if (albumId) {
        // form.setValue('title', profile?.title || '');
        // if (albumData.icon === albumData.profile?.icon || !albumData.icon) {
        //   setIsProfileEmoji(true);
        // } else {
        //   setIsProfileEmoji(false);
        // }
      } else {
        form.reset();
        setEmoji(profile?.icon || '');
        form.setValue('profileId', profileId || '');
      }
    } else {
      setIsProfileEmoji(true);
    }
  }, [showOverlay]);

  useEffect(() => {
    if (showOverlay && emoji) {
      form.setValue('icon', emoji, { shouldValidate: true });
    }
  }, [emoji, showOverlay]);

  // Profile 변경 시 이모지 업데이트 (단, 사용자가 설정하지 않았을 경우)
  const profileIdInputValue = form.watch('profileId');

  useEffect(() => {
    if (isProfileEmoji) {
      const profile = profiles?.find((item) => item.id === profileIdInputValue);
      form.setValue('icon', profile?.icon || '');
      setEmoji(profile?.icon || '');
    }
  }, [profileIdInputValue, isProfileEmoji, profiles]);

  // Emoji 선택값으로 업데이트
  useEffect(() => {
    const profile = profiles?.find((item) => item.id === profileIdInputValue);

    if (showOverlay) {
      if (emoji) {
        form.setValue('icon', emoji);
        if (emoji !== profile?.icon) {
          setIsProfileEmoji(false);
        }
      } else {
        form.setValue('icon', profile?.icon || '');
        setEmoji(profile?.icon || '');
        setIsProfileEmoji(true);
      }
    }
  }, [emoji]);

  return (
    <OverlayForm
      id="album-edit"
      className="[&>form]:flex [&>form]:flex-col [&>form]:px-8 [&>form]:items-center [&>form]:gap-4"
      title={albumId ? 'Edit album' : 'Add album'}
      form={form}
      onSubmit={submitHandler}
      isRight={true}
    >
      <div className="my-4 flex flex-col gap-4 items-center">
        {/* 이모지 */}
        <EmojiInput params={`&album-edit=show${albumId ? '&albumId=' + albumId : ''}`}>
          <input {...form.register('icon')} value={emoji} hidden />
        </EmojiInput>
        <div className="flex flex-col justify-between items-end gap-2 min-w-0 [&>select]:bg-gray-100 [&>input]:bg-gray-100 [&>*]:px-2 [&>*]:py-2.5 [&>*]:rounded-lg">
          {/* 프로필 */}
          <select {...form.register('profileId')} className="w-full h-full">
            <option value="">주제 없음</option>
            {profiles?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          {/* 제목 */}
          <input placeholder="Enter the title" {...form.register('title')} />
          {/* 활성화 여부 */}
          <ToggleButton
            checked={isActive}
            onChecked={setIsActive}
            checkedText="Active"
            uncheckedText="Inactive"
          />
        </div>
      </div>
      {/* 에러 메시지 */}
      {!!Object.keys(form.formState.errors).length && (
        <div className="w-full p-2 mt-4 text-sm bg-red-50 text-red-400 font-bold text-center rounded-lg">
          {form.formState.errors?.icon?.message && (
            <p>{form.formState.errors?.icon?.message}</p>
          )}
          {form.formState.errors?.title?.message && (
            <p>{form.formState.errors?.title?.message}</p>
          )}
          {form.formState.errors?.profileId?.message && (
            <p>{form.formState.errors?.profileId?.message}</p>
          )}
        </div>
      )}
    </OverlayForm>
  );
};

export default AlbumEditOverlay;
