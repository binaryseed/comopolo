# == Schema Info
#
# Table name: messages
#
#  id         :integer         not null, primary key
#  user_id    :integer
#  body       :text
#  created_at :datetime

require 'test_helper'

class MessageTest < ActiveSupport::TestCase
  fixtures :all
  
  def test_to_s
    m = Message.find(:first)
    assert_equal m.to_s, m.body
  end
  
end
